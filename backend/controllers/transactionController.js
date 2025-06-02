// controllers/transactionController.js
const db = require("../db")

// Get all transactions with filtering options
const getTransactions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      user_id = "",
      course_id = "",
      payment_method = "all",
      transaction_status = "all",
      start_date = "",
      end_date = "",
      min_amount = "",
      max_amount = "",
    } = req.query

    const offset = (page - 1) * limit
    let query = `
      SELECT 
        t.transaction_id, t.user_id, t.course_id, t.amount, t.currency,
        t.payment_method, t.transaction_status, t.transaction_reference,
        t.created_at, t.updated_at,
        u.username, u.email, u.first_name, u.last_name,
        c.title as course_title
      FROM transactions t
      LEFT JOIN users u ON t.user_id = u.user_id
      LEFT JOIN courses c ON t.course_id = c.course_id
      WHERE 1=1
    `

    const queryParams = []

    // Apply search filter
    if (search) {
      query += ` AND (
        u.username ILIKE $${queryParams.length + 1} OR
        u.email ILIKE $${queryParams.length + 1} OR
        u.first_name ILIKE $${queryParams.length + 1} OR
        u.last_name ILIKE $${queryParams.length + 1} OR
        c.title ILIKE $${queryParams.length + 1} OR
        t.transaction_reference ILIKE $${queryParams.length + 1}
      )`
      queryParams.push(`%${search}%`)
    }

    // Filter by user
    if (user_id) {
      query += ` AND t.user_id = $${queryParams.length + 1}`
      queryParams.push(user_id)
    }

    // Filter by course
    if (course_id) {
      query += ` AND t.course_id = $${queryParams.length + 1}`
      queryParams.push(course_id)
    }

    // Filter by payment method
    if (payment_method && payment_method !== "all") {
      query += ` AND t.payment_method = $${queryParams.length + 1}`
      queryParams.push(payment_method)
    }

    // Filter by transaction status
    if (transaction_status && transaction_status !== "all") {
      query += ` AND t.transaction_status = $${queryParams.length + 1}`
      queryParams.push(transaction_status)
    }

    // Filter by date range
    if (start_date) {
      query += ` AND t.created_at >= $${queryParams.length + 1}`
      queryParams.push(start_date)
    }

    if (end_date) {
      query += ` AND t.created_at <= $${queryParams.length + 1}`
      queryParams.push(end_date)
    }

    // Filter by amount range
    if (min_amount) {
      query += ` AND t.amount >= $${queryParams.length + 1}`
      queryParams.push(min_amount)
    }

    if (max_amount) {
      query += ` AND t.amount <= $${queryParams.length + 1}`
      queryParams.push(max_amount)
    }

    // Count total transactions for pagination
    const countQuery = `SELECT COUNT(*) FROM (${query}) AS count`
    const countResult = await db.query(countQuery, queryParams)
    const totalTransactions = Number.parseInt(countResult.rows[0].count)

    // Add pagination to the main query
    query += ` ORDER BY t.created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`
    queryParams.push(limit, offset)

    const result = await db.query(query, queryParams)

    // Format the results
    const transactions = result.rows.map((row) => ({
      transaction_id: row.transaction_id,
      amount: row.amount,
      currency: row.currency,
      payment_method: row.payment_method,
      transaction_status: row.transaction_status,
      transaction_reference: row.transaction_reference,
      created_at: row.created_at,
      updated_at: row.updated_at,
      user: {
        user_id: row.user_id,
        username: row.username,
        email: row.email,
        first_name: row.first_name,
        last_name: row.last_name,
      },
      course: {
        course_id: row.course_id,
        title: row.course_title,
      },
    }))

    res.json({
      transactions,
      pagination: {
        totalTransactions,
        totalPages: Math.ceil(totalTransactions / limit),
        currentPage: Number.parseInt(page),
        limit: Number.parseInt(limit),
      },
    })
  } catch (error) {
    console.error("Error fetching transactions:", error)
    res.status(500).json({ error: "Failed to fetch transactions" })
  }
}

// Get transaction by ID
const getTransactionById = async (req, res) => {
  try {
    const { id } = req.params

    const query = `
      SELECT 
        t.transaction_id, t.user_id, t.course_id, t.amount, t.currency,
        t.payment_method, t.transaction_status, t.transaction_reference,
        t.created_at, t.updated_at,
        u.username, u.email, u.first_name, u.last_name, u.profile_picture,
        c.title as course_title, c.thumbnail_url as course_thumbnail
      FROM transactions t
      LEFT JOIN users u ON t.user_id = u.user_id
      LEFT JOIN courses c ON t.course_id = c.course_id
      WHERE t.transaction_id = $1
    `

    const result = await db.query(query, [id])

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Transaction not found" })
    }

    const row = result.rows[0]

    // Format the transaction data
    const transaction = {
      transaction_id: row.transaction_id,
      amount: row.amount,
      currency: row.currency,
      payment_method: row.payment_method,
      transaction_status: row.transaction_status,
      transaction_reference: row.transaction_reference,
      created_at: row.created_at,
      updated_at: row.updated_at,
      user: {
        user_id: row.user_id,
        username: row.username,
        email: row.email,
        first_name: row.first_name,
        last_name: row.last_name,
        profile_picture: row.profile_picture,
      },
      course: {
        course_id: row.course_id,
        title: row.course_title,
        thumbnail: row.course_thumbnail,
      },
    }

    res.json({ transaction })
  } catch (error) {
    console.error("Error fetching transaction:", error)
    res.status(500).json({ error: "Failed to fetch transaction details" })
  }
}

// Process refund
const processRefund = async (req, res) => {
  try {
    const { id } = req.params
    const { refund_reason, refund_amount, admin_notes } = req.body

    // Check if transaction exists
    const checkTransaction = await db.query("SELECT * FROM transactions WHERE transaction_id = $1", [id])

    if (checkTransaction.rows.length === 0) {
      return res.status(404).json({ error: "Transaction not found" })
    }

    const transaction = checkTransaction.rows[0]

    // Check if transaction is eligible for refund
    if (transaction.transaction_status !== "completed") {
      return res.status(400).json({
        error: "Only completed transactions can be refunded",
      })
    }

    // Validate refund amount
    if (refund_amount <= 0 || refund_amount > transaction.amount) {
      return res.status(400).json({
        error: "Invalid refund amount",
      })
    }

    // Update transaction status to refunded
    const updateQuery = `
      UPDATE transactions
      SET 
        transaction_status = 'refunded',
        updated_at = CURRENT_TIMESTAMP
      WHERE transaction_id = $1
      RETURNING *
    `

    const result = await db.query(updateQuery, [id])

    // Create refund record
    const refundQuery = `
      INSERT INTO refunds (
        transaction_id, 
        refund_amount, 
        refund_reason, 
        admin_notes, 
        refunded_by,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      RETURNING *
    `

    const refundResult = await db.query(refundQuery, [
      id,
      refund_amount,
      refund_reason,
      admin_notes,
      req.user.user_id, // Assuming the admin user ID is available in the request
    ])

    res.json({
      message: "Refund processed successfully",
      transaction: result.rows[0],
      refund: refundResult.rows[0],
    })
  } catch (error) {
    console.error("Error processing refund:", error)
    res.status(500).json({ error: "Failed to process refund" })
  }
}

// Get financial reports
const getFinancialReports = async (req, res) => {
  try {
    const { report_type, time_period, start_date, end_date } = req.query

    // Validate report type
    if (!["revenue", "course", "instructor"].includes(report_type)) {
      return res.status(400).json({ error: "Invalid report type" })
    }

    // Set date range based on time period
    let dateFilter = ""
    const queryParams = []

    if (start_date && end_date) {
      dateFilter = "AND t.created_at BETWEEN $1 AND $2"
      queryParams.push(start_date, end_date)
    } else if (time_period) {
      switch (time_period) {
        case "today":
          dateFilter = "AND t.created_at >= CURRENT_DATE"
          break
        case "yesterday":
          dateFilter = "AND t.created_at >= CURRENT_DATE - INTERVAL '1 day' AND t.created_at < CURRENT_DATE"
          break
        case "this_week":
          dateFilter = "AND t.created_at >= date_trunc('week', CURRENT_DATE)"
          break
        case "last_week":
          dateFilter =
            "AND t.created_at >= date_trunc('week', CURRENT_DATE - INTERVAL '7 days') AND t.created_at < date_trunc('week', CURRENT_DATE)"
          break
        case "this_month":
          dateFilter = "AND t.created_at >= date_trunc('month', CURRENT_DATE)"
          break
        case "last_month":
          dateFilter =
            "AND t.created_at >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month') AND t.created_at < date_trunc('month', CURRENT_DATE)"
          break
        case "this_year":
          dateFilter = "AND t.created_at >= date_trunc('year', CURRENT_DATE)"
          break
        case "last_year":
          dateFilter =
            "AND t.created_at >= date_trunc('year', CURRENT_DATE - INTERVAL '1 year') AND t.created_at < date_trunc('year', CURRENT_DATE)"
          break
        default:
          dateFilter = ""
      }
    }

    let query = ""
    let reportData = []

    // Generate report based on type
    if (report_type === "revenue") {
      // Revenue over time report
      query = `
        SELECT 
          date_trunc('day', t.created_at) as date,
          COUNT(*) as transaction_count,
          SUM(t.amount) as total_amount,
          COUNT(CASE WHEN t.transaction_status = 'completed' THEN 1 END) as completed_count,
          SUM(CASE WHEN t.transaction_status = 'completed' THEN t.amount ELSE 0 END) as completed_amount,
          COUNT(CASE WHEN t.transaction_status = 'refunded' THEN 1 END) as refunded_count,
          SUM(CASE WHEN t.transaction_status = 'refunded' THEN t.amount ELSE 0 END) as refunded_amount
        FROM transactions t
        WHERE t.transaction_status IN ('completed', 'refunded') ${dateFilter}
        GROUP BY date
        ORDER BY date
      `

      const result = await db.query(query, queryParams)
      reportData = result.rows
    } else if (report_type === "course") {
      // Revenue by course report
      query = `
        SELECT 
          c.course_id,
          c.title as course_title,
          COUNT(t.transaction_id) as transaction_count,
          SUM(t.amount) as total_amount,
          COUNT(CASE WHEN t.transaction_status = 'completed' THEN 1 END) as completed_count,
          SUM(CASE WHEN t.transaction_status = 'completed' THEN t.amount ELSE 0 END) as completed_amount,
          COUNT(CASE WHEN t.transaction_status = 'refunded' THEN 1 END) as refunded_count,
          SUM(CASE WHEN t.transaction_status = 'refunded' THEN t.amount ELSE 0 END) as refunded_amount
        FROM transactions t
        JOIN courses c ON t.course_id = c.course_id
        WHERE t.transaction_status IN ('completed', 'refunded') ${dateFilter}
        GROUP BY c.course_id, c.title
        ORDER BY completed_amount DESC
      `

      const result = await db.query(query, queryParams)
      reportData = result.rows
    } else if (report_type === "instructor") {
      // Revenue by instructor report
      query = `
        SELECT 
          u.user_id as instructor_id,
          u.username as instructor_username,
          u.first_name as instructor_first_name,
          u.last_name as instructor_last_name,
          COUNT(t.transaction_id) as transaction_count,
          SUM(t.amount) as total_amount,
          COUNT(CASE WHEN t.transaction_status = 'completed' THEN 1 END) as completed_count,
          SUM(CASE WHEN t.transaction_status = 'completed' THEN t.amount ELSE 0 END) as completed_amount,
          COUNT(CASE WHEN t.transaction_status = 'refunded' THEN 1 END) as refunded_count,
          SUM(CASE WHEN t.transaction_status = 'refunded' THEN t.amount ELSE 0 END) as refunded_amount
        FROM transactions t
        JOIN courses c ON t.course_id = c.course_id
        JOIN users u ON c.instructor_id = u.user_id
        WHERE t.transaction_status IN ('completed', 'refunded') ${dateFilter}
        GROUP BY u.user_id, u.username, u.first_name, u.last_name
        ORDER BY completed_amount DESC
      `

      const result = await db.query(query, queryParams)
      reportData = result.rows
    }

    // Get summary statistics
    const summaryQuery = `
      SELECT 
        COUNT(*) as total_transactions,
        SUM(amount) as total_amount,
        COUNT(CASE WHEN transaction_status = 'completed' THEN 1 END) as completed_transactions,
        SUM(CASE WHEN transaction_status = 'completed' THEN amount ELSE 0 END) as completed_amount,
        COUNT(CASE WHEN transaction_status = 'refunded' THEN 1 END) as refunded_transactions,
        SUM(CASE WHEN transaction_status = 'refunded' THEN amount ELSE 0 END) as refunded_amount,
        COUNT(CASE WHEN transaction_status = 'pending' THEN 1 END) as pending_transactions,
        SUM(CASE WHEN transaction_status = 'pending' THEN amount ELSE 0 END) as pending_amount,
        COUNT(CASE WHEN transaction_status = 'failed' THEN 1 END) as failed_transactions
      FROM transactions t
      WHERE 1=1 ${dateFilter}
    `

    const summaryResult = await db.query(summaryQuery, queryParams)
    const summary = summaryResult.rows[0]

    // Get payment method breakdown
    const paymentMethodQuery = `
      SELECT 
        payment_method,
        COUNT(*) as transaction_count,
        SUM(amount) as total_amount
      FROM transactions t
      WHERE transaction_status = 'completed' ${dateFilter}
      GROUP BY payment_method
      ORDER BY total_amount DESC
    `

    const paymentMethodResult = await db.query(paymentMethodQuery, queryParams)
    const paymentMethods = paymentMethodResult.rows

    res.json({
      report_type,
      time_period,
      start_date,
      end_date,
      summary,
      payment_methods: paymentMethods,
      data: reportData,
    })
  } catch (error) {
    console.error("Error generating financial report:", error)
    res.status(500).json({ error: "Failed to generate financial report" })
  }
}

// Get refund requests
const getRefundRequests = async (req, res) => {
  try {
    const { page = 1, limit = 10, status = "all" } = req.query
    const offset = (page - 1) * limit

    let query = `
      SELECT 
        r.refund_id, r.transaction_id, r.refund_amount, r.refund_reason,
        r.refund_status, r.created_at, r.processed_at,
        t.amount as transaction_amount, t.payment_method, t.created_at as transaction_date,
        u.user_id, u.username, u.email, u.first_name, u.last_name,
        c.course_id, c.title as course_title
      FROM refunds r
      JOIN transactions t ON r.transaction_id = t.transaction_id
      JOIN users u ON t.user_id = u.user_id
      LEFT JOIN courses c ON t.course_id = c.course_id
      WHERE 1=1
    `

    const queryParams = []

    // Filter by status
    if (status && status !== "all") {
      query += ` AND r.refund_status = $${queryParams.length + 1}`
      queryParams.push(status)
    }

    // Count total refund requests for pagination
    const countQuery = `SELECT COUNT(*) FROM (${query}) AS count`
    const countResult = await db.query(countQuery, queryParams)
    const totalRefunds = Number.parseInt(countResult.rows[0].count)

    // Add pagination to the main query
    query += ` ORDER BY r.created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`
    queryParams.push(limit, offset)

    const result = await db.query(query, queryParams)

    // Format the results
    const refunds = result.rows.map((row) => ({
      refund_id: row.refund_id,
      transaction_id: row.transaction_id,
      refund_amount: row.refund_amount,
      transaction_amount: row.transaction_amount,
      refund_reason: row.refund_reason,
      refund_status: row.refund_status,
      created_at: row.created_at,
      processed_at: row.processed_at,
      payment_method: row.payment_method,
      transaction_date: row.transaction_date,
      user: {
        user_id: row.user_id,
        username: row.username,
        email: row.email,
        first_name: row.first_name,
        last_name: row.last_name,
      },
      course: {
        course_id: row.course_id,
        title: row.course_title,
      },
    }))

    res.json({
      refunds,
      pagination: {
        totalRefunds,
        totalPages: Math.ceil(totalRefunds / limit),
        currentPage: Number.parseInt(page),
        limit: Number.parseInt(limit),
      },
    })
  } catch (error) {
    console.error("Error fetching refund requests:", error)
    res.status(500).json({ error: "Failed to fetch refund requests" })
  }
}

// Update refund request status
const updateRefundStatus = async (req, res) => {
  try {
    const { id } = req.params
    const { refund_status, admin_notes } = req.body

    // Validate status
    if (!["approved", "rejected", "processing"].includes(refund_status)) {
      return res.status(400).json({ error: "Invalid refund status" })
    }

    // Check if refund request exists
    const checkRefund = await db.query("SELECT * FROM refunds WHERE refund_id = $1", [id])

    if (checkRefund.rows.length === 0) {
      return res.status(404).json({ error: "Refund request not found" })
    }

    const refund = checkRefund.rows[0]

    // Check if refund is already processed
    if (refund.refund_status === "approved" || refund.refund_status === "rejected") {
      return res.status(400).json({
        error: "This refund request has already been processed",
      })
    }

    // Update refund status
    const updateQuery = `
      UPDATE refunds
      SET 
        refund_status = $1,
        admin_notes = $2,
        processed_at = CURRENT_TIMESTAMP,
        processed_by = $3
      WHERE refund_id = $4
      RETURNING *
    `

    const result = await db.query(updateQuery, [
      refund_status,
      admin_notes,
      req.user.user_id, // Assuming the admin user ID is available in the request
      id,
    ])

    // If approved, update transaction status
    if (refund_status === "approved") {
      await db.query(
        "UPDATE transactions SET transaction_status = 'refunded', updated_at = CURRENT_TIMESTAMP WHERE transaction_id = $1",
        [refund.transaction_id],
      )
    }

    res.json({
      message: `Refund request ${refund_status}`,
      refund: result.rows[0],
    })
  } catch (error) {
    console.error("Error updating refund status:", error)
    res.status(500).json({ error: "Failed to update refund status" })
  }
}

// Create a new transaction (for testing purposes)
const createTransaction = async (req, res) => {
  try {
    const {
      user_id,
      course_id,
      amount,
      currency = "VND",
      payment_method,
      transaction_status = "completed",
      transaction_reference,
    } = req.body

    // Validate required fields
    if (!user_id || !course_id || !amount || !payment_method) {
      return res.status(400).json({ error: "Missing required fields" })
    }

    // Create transaction in the database
    const insertQuery = `
      INSERT INTO transactions (
        user_id,
        course_id,
        amount,
        currency,
        payment_method,
        transaction_status,
        transaction_reference,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `

    const result = await db.query(insertQuery, [
      user_id,
      course_id,
      amount,
      currency,
      payment_method,
      transaction_status,
      transaction_reference || `TXN-${Date.now()}`,
    ])

    res.status(201).json({
      message: "Transaction created successfully",
      transaction: result.rows[0],
    })
  } catch (error) {
    console.error("Error creating transaction:", error)
    res.status(500).json({ error: "Failed to create transaction" })
  }
}

module.exports = {
  getTransactions,
  getTransactionById,
  processRefund,
  getFinancialReports,
  getRefundRequests,
  updateRefundStatus,
  createTransaction,
}
