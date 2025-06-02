// paymentController.js
const db = require("../db")
const crypto = require("crypto")
const axios = require("axios")
const { v4: uuidv4 } = require("uuid") // For MoMo request IDs

exports.processPayment = async (req, res) => {
  try {
    console.log("Received payment request:", req.body) // Thêm log để debug
    const { courseId, transactionId, paymentMethod } = req.body
    const userId = req.user.user_id

    // Kiểm tra khóa học
    const courseQuery = `
      SELECT * FROM courses
      WHERE course_id = $1 AND is_published = true
    `
    const { rows: courses } = await db.query(courseQuery, [courseId])
    if (courses.length === 0) {
      console.log("Course not found for courseId:", courseId)
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy khóa học",
      })
    }
    const course = courses[0]

    // Kiểm tra giao dịch
    const transactionQuery = `
      SELECT * FROM transactions
      WHERE transaction_id = $1 AND user_id = $2 AND course_id = $3 AND transaction_status = 'pending'
    `
    const { rows: transactions } = await db.query(transactionQuery, [transactionId, userId, courseId])
    if (transactions.length === 0) {
      console.log("Transaction not found for transactionId:", transactionId)
      return res.status(404).json({
        success: false,
        message: "Giao dịch không hợp lệ hoặc đã được xử lý",
      })
    }

    // Kiểm tra đã đăng ký chưa
    const enrollmentQuery = `
      SELECT * FROM user_courses
      WHERE user_id = $1 AND course_id = $2
    `
    const { rows: enrollments } = await db.query(enrollmentQuery, [userId, courseId])
    if (enrollments.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Bạn đã đăng ký khóa học này rồi",
      })
    }

    // Xử lý khóa học miễn phí
    if (course.price === 0) {
      await db.query(
        `
        UPDATE transactions
        SET transaction_status = 'completed',
            updated_at = CURRENT_TIMESTAMP
        WHERE transaction_id = $1
      `,
        [transactionId],
      )

      await db.query(
        `
        INSERT INTO user_courses (user_id, course_id, enrollment_date, progress_percentage)
        VALUES ($1, $2, CURRENT_TIMESTAMP, 0)
        ON CONFLICT DO NOTHING
      `,
        [userId, courseId],
      )

      return res.status(200).json({
        success: true,
        message: "Đăng ký khóa học miễn phí thành công",
      })
    }

    // Xử lý thanh toán
    let redirectUrl
    switch (paymentMethod) {
      case "vnpay":
        redirectUrl = await generateVNPayUrl({
          transactionId,
          amount: course.price,
          userId,
          courseId,
        })
        break
      case "momo":
        redirectUrl = await generateMoMoUrl({
          transactionId,
          amount: course.price,
          userId,
          courseId,
        })
        break
      case "credit_card":
        return res.status(501).json({
          success: false,
          message: "Phương thức thanh toán thẻ tín dụng chưa được triển khai",
        })
      default:
        return res.status(400).json({
          success: false,
          message: "Phương thức thanh toán không hợp lệ",
        })
    }

    return res.status(200).json({
      success: true,
      redirectUrl,
    })
  } catch (error) {
    console.error("Lỗi khi xử lý thanh toán:", error)
    return res.status(500).json({
      success: false,
      message: error.message || "Đã xảy ra lỗi khi xử lý thanh toán",
    })
  }
}

// Generate VNPay payment URL
const generateVNPayUrl = async ({ transactionId, amount, userId, courseId }) => {
  const vnpUrl = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html"
  const vnpTmnCode = process.env.VNP_TMNCODE
  const vnpHashSecret = process.env.VNP_HASHSECRET
  const vnpReturnUrl = process.env.VNP_RETURN_URL || "http://localhost:3000/api/payments/vnpay-callback"

  const date = new Date()
  const createDate = date
    .toISOString()
    .replace(/[-:T.]/g, "")
    .slice(0, 14)
  const orderId = `${transactionId}-${Date.now()}`

  const params = {
    vnp_Version: "2.1.0",
    vnp_Command: "pay",
    vnp_TmnCode: vnpTmnCode,
    vnp_Amount: amount * 100,
    vnp_CurrCode: "VND",
    vnp_TxnRef: orderId,
    vnp_OrderInfo: `Thanh toán khóa học ${courseId} cho user ${userId}`,
    vnp_OrderType: "course-payment",
    vnp_Locale: "vn",
    vnp_CreateDate: createDate,
    vnp_IpAddr: "127.0.0.1",
    vnp_ReturnUrl: vnpReturnUrl,
  }

  const sortedParams = Object.keys(params)
    .sort()
    .reduce((result, key) => {
      result[key] = params[key]
      return result
    }, {})

  const querystring = new URLSearchParams(sortedParams).toString()
  const secureHash = crypto.createHmac("sha512", vnpHashSecret).update(querystring).digest("hex")
  return `${vnpUrl}?${querystring}&vnp_SecureHash=${secureHash}`
}

// Generate MoMo payment URL
const generateMoMoUrl = async ({ transactionId, amount, userId, courseId }) => {
  const momoEndpoint = "https://test-payment.momo.vn/v2/gateway/api/create"
  const partnerCode = process.env.MOMO_PARTNER_CODE
  const accessKey = process.env.MOMO_ACCESS_KEY
  const secretKey = process.env.MOMO_SECRET_KEY
  const returnUrl = process.env.MOMO_RETURN_URL || "http://localhost:3000/api/payments/momo-callback"
  const notifyUrl = process.env.MOMO_NOTIFY_URL || "http://localhost:3000/api/payments/momo-notify"

  const requestId = uuidv4()
  const orderId = `${transactionId}-${Date.now()}`
  const orderInfo = `Thanh toán khóa học ${courseId} cho user ${userId}`
  const amountStr = Math.round(amount).toString()

  const rawSignature = `accessKey=${accessKey}&amount=${amountStr}&extraData=&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${returnUrl}&requestId=${requestId}&requestType=captureWallet`
  const signature = crypto.createHmac("sha256", secretKey).update(rawSignature).digest("hex")

  const requestBody = {
    partnerCode,
    partnerName: "CoursePlatform",
    storeId: "CoursePlatform",
    requestId,
    amount: amountStr,
    orderId,
    orderInfo,
    redirectUrl: returnUrl,
    notifyUrl,
    requestType: "captureWallet",
    lang: "vi",
    signature,
  }

  const response = await axios.post(momoEndpoint, requestBody)
  if (response.data.payUrl) {
    return response.data.payUrl
  } else {
    throw new Error("Không thể tạo URL thanh toán MoMo")
  }
}

// Handle VNPay callback
exports.handleVNPayCallback = async (req, res) => {
  try {
    const vnpParams = req.query
    const secureHash = vnpParams["vnp_SecureHash"]
    delete vnpParams["vnp_SecureHash"]
    delete vnpParams["vnp_SecureHashType"]

    const sortedParams = Object.keys(vnpParams)
      .sort()
      .reduce((result, key) => {
        result[key] = vnpParams[key]
        return result
      }, {})

    const vnpHashSecret = process.env.VNP_HASHSECRET
    const querystring = new URLSearchParams(sortedParams).toString()
    const calculatedHash = crypto.createHmac("sha512", vnpHashSecret).update(querystring).digest("hex")

    if (secureHash !== calculatedHash) {
      return res.redirect("/payment/failed?error=invalid_signature")
    }

    const transactionId = vnpParams["vnp_TxnRef"].split("-")[0]
    const responseCode = vnpParams["vnp_ResponseCode"]

    if (responseCode === "00") {
      await db.query(
        `
        UPDATE transactions
        SET transaction_status = 'completed',
            updated_at = CURRENT_TIMESTAMP
        WHERE transaction_id = $1
      `,
        [transactionId],
      )

      const transaction = (
        await db.query(
          `
        SELECT user_id, course_id FROM transactions
        WHERE transaction_id = $1
      `,
          [transactionId],
        )
      ).rows[0]

      await db.query(
        `
        INSERT INTO user_courses (user_id, course_id, enrollment_date, progress_percentage)
        VALUES ($1, $2, CURRENT_TIMESTAMP, 0)
        ON CONFLICT DO NOTHING
      `,
        [transaction.user_id, transaction.course_id],
      )

      return res.redirect(`/user/courses/${transaction.course_id}/learn?payment=success`)
    } else {
      await db.query(
        `
        UPDATE transactions
        SET transaction_status = 'failed',
            updated_at = CURRENT_TIMESTAMP
        WHERE transaction_id = $1
      `,
        [transactionId],
      )
      return res.redirect("/payment/failed?error=payment_failed")
    }
  } catch (error) {
    console.error("Lỗi khi xử lý callback VNPay:", error)
    return res.redirect("/payment/failed?error=server_error")
  }
}

// Handle MoMo callback
exports.handleMoMoCallback = async (req, res) => {
  try {
    const { orderId, resultCode } = req.body
    const transactionId = orderId.split("-")[0]

    if (resultCode === 0) {
      await db.query(
        `
        UPDATE transactions
        SET transaction_status = 'completed',
            updated_at = CURRENT_TIMESTAMP
        WHERE transaction_id = $1
      `,
        [transactionId],
      )

      const transaction = (
        await db.query(
          `
        SELECT user_id, course_id FROM transactions
        WHERE transaction_id = $1
      `,
          [transactionId],
        )
      ).rows[0]

      await db.query(
        `
        INSERT INTO user_courses (user_id, course_id, enrollment_date, progress_percentage)
        VALUES ($1, $2, CURRENT_TIMESTAMP, 0)
        ON CONFLICT DO NOTHING
      `,
        [transaction.user_id, transaction.course_id],
      )

      return res.redirect(`/user/courses/${transaction.course_id}/learn?payment=success`)
    } else {
      await db.query(
        `
        UPDATE transactions
        SET transaction_status = 'failed',
            updated_at = CURRENT_TIMESTAMP
        WHERE transaction_id = $1
      `,
        [transactionId],
      )
      return res.redirect("/payment/failed?error=payment_failed")
    }
  } catch (error) {
    console.error("Lỗi khi xử lý callback MoMo:", error)
    return res.redirect("/payment/failed?error=server_error")
  }
}

// Request a refund
exports.requestRefund = async (req, res) => {
  try {
    const { transactionId, refundReason } = req.body
    const userId = req.user.user_id

    // Verify transaction
    const transactionQuery = `
      SELECT t.*, c.price
      FROM transactions t
      JOIN courses c ON t.course_id = c.course_id
      WHERE t.transaction_id = $1 AND t.user_id = $2 AND t.transaction_status = 'completed'
    `
    const { rows: transactions } = await db.query(transactionQuery, [transactionId, userId])
    if (transactions.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy giao dịch hợp lệ để hoàn tiền",
      })
    }
    const transaction = transactions[0]

    // Check if already refunded
    const refundQuery = `
      SELECT * FROM refunds
      WHERE transaction_id = $1
    `
    const { rows: refunds } = await db.query(refundQuery, [transactionId])
    if (refunds.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Giao dịch này đã được yêu cầu hoàn tiền",
      })
    }

    // Create refund request
    const insertRefundQuery = `
      INSERT INTO refunds (transaction_id, refund_amount, refund_reason, refund_status, created_at)
      VALUES ($1, $2, $3, 'pending', CURRENT_TIMESTAMP)
      RETURNING refund_id
    `
    const { rows: refundResult } = await db.query(insertRefundQuery, [transactionId, transaction.amount, refundReason])

    return res.status(200).json({
      success: true,
      refundId: refundResult[0].refund_id,
      message: "Yêu cầu hoàn tiền đã được gửi",
    })
  } catch (error) {
    console.error("Error requesting refund:", error)
    return res.status(500).json({
      success: false,
      message: "Đã xảy ra lỗi khi yêu cầu hoàn tiền",
    })
  }
}

// Get payment status
exports.getPaymentStatus = async (req, res) => {
  try {
    const { transactionId } = req.params
    const userId = req.user.user_id

    const transactionQuery = `
      SELECT t.*, c.title as course_title
      FROM transactions t
      JOIN courses c ON t.course_id = c.course_id
      WHERE t.transaction_id = $1 AND t.user_id = $2
    `
    const { rows: transactions } = await db.query(transactionQuery, [transactionId, userId])

    if (transactions.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy giao dịch",
      })
    }

    return res.status(200).json({
      success: true,
      transaction: transactions[0],
    })
  } catch (error) {
    console.error("Error fetching payment status:", error)
    return res.status(500).json({
      success: false,
      message: "Đã xảy ra lỗi khi kiểm tra trạng thái thanh toán",
    })
  }
}
