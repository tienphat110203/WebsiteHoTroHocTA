const db = require("../db")
const { v4: uuidv4 } = require("uuid")
const PDFDocument = require("pdfkit")
const QRCode = require("qrcode")
const fs = require("fs")
const path = require("path")
const Handlebars = require("handlebars")
const moment = require("moment")
const puppeteer = require("puppeteer")
const { validationResult } = require("express-validator")
const crypto = require("crypto")

// Register Handlebars helpers
Handlebars.registerHelper("format_date", (date, format) => moment(date).format(format))

// Certificate Template Controllers
// Get certificate templates with pagination and search
const getTemplates = async (req, res) => {
  try {
    const { page = 1, search = "" } = req.query
    const limit = 10
    const offset = (page - 1) * limit

    // Build the query with proper parameter placeholders
    let query = `
      SELECT 
        t.template_id, 
        t.name, 
        t.description, 
        t.is_active, 
        t.created_at, 
        t.updated_at,
        (SELECT COUNT(*) FROM certificates WHERE template_id = t.template_id) as usage_count
      FROM certificate_templates t
      WHERE 1=1
    `

    const queryParams = []

    // Add search condition if search term is provided
    if (search) {
      query += ` AND (t.name ILIKE $1 OR t.description ILIKE $1)`
      queryParams.push(`%${search}%`)
    }

    // Count total for pagination
    const countQuery = `SELECT COUNT(*) FROM (${query}) AS count`
    const countResult = await db.query(countQuery, queryParams)
    const totalCount = Number.parseInt(countResult.rows[0].count)

    // Add ordering and pagination
    query += ` ORDER BY t.created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`
    queryParams.push(limit, offset)

    // Execute the main query
    const result = await db.query(query, queryParams)

    // Return the response
    res.status(200).json({
      templates: result.rows,
      pagination: {
        totalPages: Math.ceil(totalCount / limit),
        currentPage: Number.parseInt(page),
        totalItems: totalCount,
        hasNextPage: Number.parseInt(page) < Math.ceil(totalCount / limit),
        hasPrevPage: Number.parseInt(page) > 1,
      },
    })
  } catch (error) {
    console.error("Error fetching certificate templates:", error)
    res.status(500).json({ error: "Failed to fetch certificate templates" })
  }
}

// Get a single template by ID
const getTemplateById = async (req, res) => {
  try {
    const { id } = req.params

    const templateQuery = `
      SELECT 
        t.template_id, 
        t.name, 
        t.description, 
        t.html_content,
        t.css_content,
        t.is_active, 
        t.created_at, 
        t.updated_at,
        u.username as created_by_username
      FROM certificate_templates t
      LEFT JOIN users u ON t.created_by = u.user_id
      WHERE t.template_id = $1
    `

    const templateResult = await db.query(templateQuery, [id])

    if (templateResult.rows.length === 0) {
      return res.status(404).json({ error: "Certificate template not found" })
    }

    const template = templateResult.rows[0]

    // Get template fields
    const fieldsQuery = `
      SELECT field_id, field_name, field_type, default_value, is_required, position
      FROM certificate_fields
      WHERE template_id = $1
      ORDER BY position
    `

    const fieldsResult = await db.query(fieldsQuery, [id])
    template.fields = fieldsResult.rows

    res.json({ template })
  } catch (error) {
    console.error("Error fetching certificate template:", error)
    res.status(500).json({ error: "Failed to fetch certificate template" })
  }
}

// Create a new certificate template
const createTemplate = async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const { name, description, html_content, css_content, is_active, fields } = req.body

    // Insert template
    const insertTemplateQuery = `
      INSERT INTO certificate_templates (
        name, description, html_content, css_content, is_active, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING template_id, name, description, is_active, created_at
    `

    const templateResult = await db.query(insertTemplateQuery, [
      name,
      description,
      html_content,
      css_content,
      is_active,
      req.user.user_id,
    ])

    const template = templateResult.rows[0]

    // Insert fields if provided
    if (fields && fields.length > 0) {
      const insertFieldsQuery = `
        INSERT INTO certificate_fields (
          template_id, field_name, field_type, default_value, is_required, position
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING field_id, field_name, field_type, default_value, is_required, position
      `

      const fieldPromises = fields.map((field, index) => {
        return db.query(insertFieldsQuery, [
          template.template_id,
          field.field_name,
          field.field_type,
          field.default_value,
          field.is_required,
          index + 1,
        ])
      })

      const fieldResults = await Promise.all(fieldPromises)
      template.fields = fieldResults.map((result) => result.rows[0])
    }

    res.status(201).json({
      template,
      message: "Certificate template created successfully",
    })
  } catch (error) {
    console.error("Error creating certificate template:", error)
    res.status(500).json({ error: "Failed to create certificate template" })
  }
}

// Update a certificate template
const updateTemplate = async (req, res) => {
  try {
    const { id } = req.params
    const { name, description, html_content, css_content, is_active, fields } = req.body

    // Check if template exists
    const checkTemplate = await db.query("SELECT * FROM certificate_templates WHERE template_id = $1", [id])
    if (checkTemplate.rows.length === 0) {
      return res.status(404).json({ error: "Certificate template not found" })
    }

    // Update template
    const updateTemplateQuery = `
      UPDATE certificate_templates
      SET name = $1, 
          description = $2, 
          html_content = $3, 
          css_content = $4, 
          is_active = $5,
          updated_at = CURRENT_TIMESTAMP
      WHERE template_id = $6
      RETURNING template_id, name, description, is_active, updated_at
    `

    const templateResult = await db.query(updateTemplateQuery, [
      name,
      description,
      html_content,
      css_content,
      is_active,
      id,
    ])

    const template = templateResult.rows[0]

    // Update fields if provided
    if (fields && fields.length > 0) {
      // Delete existing fields
      await db.query("DELETE FROM certificate_fields WHERE template_id = $1", [id])

      // Insert new fields
      const insertFieldsQuery = `
        INSERT INTO certificate_fields (
          template_id, field_name, field_type, default_value, is_required, position
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING field_id, field_name, field_type, default_value, is_required, position
      `

      const fieldPromises = fields.map((field, index) => {
        return db.query(insertFieldsQuery, [
          id,
          field.field_name,
          field.field_type,
          field.default_value,
          field.is_required,
          index + 1,
        ])
      })

      const fieldResults = await Promise.all(fieldPromises)
      template.fields = fieldResults.map((result) => result.rows[0])
    }

    res.json({
      template,
      message: "Certificate template updated successfully",
    })
  } catch (error) {
    console.error("Error updating certificate template:", error)
    res.status(500).json({ error: "Failed to update certificate template" })
  }
}

// Delete a certificate template
const deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params

    // Check if template exists
    const checkTemplate = await db.query("SELECT * FROM certificate_templates WHERE template_id = $1", [id])
    if (checkTemplate.rows.length === 0) {
      return res.status(404).json({ error: "Certificate template not found" })
    }

    // Check if template is in use
    const checkUsage = await db.query("SELECT COUNT(*) FROM certificates WHERE template_id = $1", [id])
    if (Number.parseInt(checkUsage.rows[0].count) > 0) {
      return res.status(400).json({ error: "Cannot delete template that is in use by certificates" })
    }

    // Delete template (cascade will delete fields)
    await db.query("DELETE FROM certificate_templates WHERE template_id = $1", [id])

    res.json({ message: "Certificate template deleted successfully" })
  } catch (error) {
    console.error("Error deleting certificate template:", error)
    res.status(500).json({ error: "Failed to delete certificate template" })
  }
}

// Certificate Controllers
// Get all certificates with pagination and filters
const getCertificates = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      course_id = "",
      template_id = "",
      date_from = "",
      date_to = "",
      is_revoked = "",
    } = req.query
    const offset = (page - 1) * limit

    let query = `
      SELECT 
        c.certificate_id, 
        c.user_id, 
        c.course_id, 
        c.template_id, 
        c.verification_code, 
        c.issue_date, 
        c.expiry_date, 
        c.is_revoked,
        u.first_name, 
        u.last_name, 
        u.email,
        co.title as course_title,
        t.name as template_name
      FROM certificates c
      JOIN users u ON c.user_id = u.user_id
      JOIN courses co ON c.course_id = co.course_id
      JOIN certificate_templates t ON c.template_id = t.template_id
      WHERE 1=1
    `

    const queryParams = []

    // Apply search filter
    if (search) {
      query += ` AND (
        u.first_name ILIKE $${queryParams.length + 1} OR
        u.last_name ILIKE $${queryParams.length + 1} OR
        u.email ILIKE $${queryParams.length + 1} OR
        co.title ILIKE $${queryParams.length + 1} OR
        c.verification_code ILIKE $${queryParams.length + 1}
      )`
      queryParams.push(`%${search}%`)
    }

    // Apply course filter
    if (course_id) {
      query += ` AND c.course_id = $${queryParams.length + 1}`
      queryParams.push(course_id)
    }

    // Apply template filter
    if (template_id) {
      query += ` AND c.template_id = $${queryParams.length + 1}`
      queryParams.push(template_id)
    }

    // Apply date range filter
    if (date_from) {
      query += ` AND c.issue_date >= $${queryParams.length + 1}`
      queryParams.push(date_from)
    }

    if (date_to) {
      query += ` AND c.issue_date <= $${queryParams.length + 1}`
      queryParams.push(date_to)
    }

    // Apply revocation status filter
    if (is_revoked !== "") {
      query += ` AND c.is_revoked = $${queryParams.length + 1}`
      queryParams.push(is_revoked === "true")
    }

    // Count total certificates for pagination
    const countQuery = `SELECT COUNT(*) FROM (${query}) AS count`
    const countResult = await db.query(countQuery, queryParams)
    const totalCertificates = Number.parseInt(countResult.rows[0].count)

    // Add pagination to the main query
    query += ` ORDER BY c.issue_date DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`
    queryParams.push(limit, offset)

    const result = await db.query(query, queryParams)

    // Format the results
    const certificates = result.rows.map((row) => ({
      certificate_id: row.certificate_id,
      verification_code: row.verification_code,
      issue_date: row.issue_date,
      expiry_date: row.expiry_date,
      is_revoked: row.is_revoked,
      student: {
        user_id: row.user_id,
        full_name: `${row.first_name} ${row.last_name}`,
        email: row.email,
      },
      course: {
        course_id: row.course_id,
        title: row.course_title,
      },
      template: {
        template_id: row.template_id,
        name: row.template_name,
      },
    }))

    res.json({
      certificates,
      pagination: {
        totalCertificates,
        totalPages: Math.ceil(totalCertificates / limit),
        currentPage: Number.parseInt(page),
        limit: Number.parseInt(limit),
      },
    })
  } catch (error) {
    console.error("Error fetching certificates:", error)
    res.status(500).json({ error: "Failed to fetch certificates" })
  }
}

// Get a single certificate by ID
const getCertificateById = async (req, res) => {
  try {
    const { id } = req.params

    const query = `
      SELECT 
        c.certificate_id, 
        c.user_id, 
        c.course_id, 
        c.template_id, 
        c.verification_code, 
        c.issue_date, 
        c.expiry_date, 
        c.is_revoked,
        c.revocation_reason,
        c.metadata,
        u.first_name, 
        u.last_name, 
        u.email,
        u.username,
        co.title as course_title,
        co.description as course_description,
        t.name as template_name,
        t.html_content,
        t.css_content
      FROM certificates c
      JOIN users u ON c.user_id = u.user_id
      JOIN courses co ON c.course_id = co.course_id
      JOIN certificate_templates t ON c.template_id = t.template_id
      WHERE c.certificate_id = $1
    `

    const result = await db.query(query, [id])

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Certificate not found" })
    }

    const row = result.rows[0]

    // Format the certificate data
    const certificate = {
      certificate_id: row.certificate_id,
      verification_code: row.verification_code,
      issue_date: row.issue_date,
      expiry_date: row.expiry_date,
      is_revoked: row.is_revoked,
      revocation_reason: row.revocation_reason,
      metadata: row.metadata,
      student: {
        user_id: row.user_id,
        username: row.username,
        full_name: `${row.first_name} ${row.last_name}`,
        email: row.email,
      },
      course: {
        course_id: row.course_id,
        title: row.course_title,
        description: row.course_description,
      },
      template: {
        template_id: row.template_id,
        name: row.template_name,
        html_content: row.html_content,
        css_content: row.css_content,
      },
    }

    res.json({ certificate })
  } catch (error) {
    console.error("Error fetching certificate:", error)
    res.status(500).json({ error: "Failed to fetch certificate" })
  }
}

// Issue a new certificate
const issueCertificate = async (req, res) => {
  try {
    const { user_id, course_id, template_id, expiry_date, metadata } = req.body

    // Check if user exists
    const userCheck = await db.query("SELECT * FROM users WHERE user_id = $1", [user_id])
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: "User not found" })
    }

    // Check if course exists
    const courseCheck = await db.query("SELECT * FROM courses WHERE course_id = $1", [course_id])
    if (courseCheck.rows.length === 0) {
      return res.status(404).json({ error: "Course not found" })
    }

    // Check if template exists
    const templateCheck = await db.query("SELECT * FROM certificate_templates WHERE template_id = $1", [template_id])
    if (templateCheck.rows.length === 0) {
      return res.status(404).json({ error: "Certificate template not found" })
    }

    // Check if certificate already exists for this user and course
    const existingCert = await db.query("SELECT * FROM certificates WHERE user_id = $1 AND course_id = $2", [
      user_id,
      course_id,
    ])

    if (existingCert.rows.length > 0) {
      return res.status(400).json({ error: "Certificate already exists for this user and course" })
    }

    // Generate a unique verification code
    const verificationCode = crypto.randomBytes(32).toString("hex")

    // Insert the certificate
    const insertQuery = `
      INSERT INTO certificates (
        user_id, course_id, template_id, verification_code, 
        issue_date, expiry_date, metadata
      )
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5, $6)
      RETURNING certificate_id, verification_code, issue_date
    `

    const result = await db.query(insertQuery, [
      user_id,
      course_id,
      template_id,
      verificationCode,
      expiry_date,
      metadata,
    ])

    res.status(201).json({
      certificate: result.rows[0],
      message: "Certificate issued successfully",
    })
  } catch (error) {
    console.error("Error issuing certificate:", error)
    res.status(500).json({ error: "Failed to issue certificate" })
  }
}

// Bulk issue certificates
const bulkIssueCertificates = async (req, res) => {
  try {
    const { course_id, template_id, user_ids, expiry_date } = req.body

    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      return res.status(400).json({ error: "No users specified for certificate issuance" })
    }

    // Check if course exists
    const courseCheck = await db.query("SELECT * FROM courses WHERE course_id = $1", [course_id])
    if (courseCheck.rows.length === 0) {
      return res.status(404).json({ error: "Course not found" })
    }

    // Check if template exists
    const templateCheck = await db.query("SELECT * FROM certificate_templates WHERE template_id = $1", [template_id])
    if (templateCheck.rows.length === 0) {
      return res.status(404).json({ error: "Certificate template not found" })
    }

    // Start a transaction
    await db.query("BEGIN")

    const results = {
      success: [],
      failed: [],
      skipped: [],
    }

    // Process each user
    for (const userId of user_ids) {
      try {
        // Check if user exists
        const userCheck = await db.query("SELECT * FROM users WHERE user_id = $1", [userId])
        if (userCheck.rows.length === 0) {
          results.failed.push({
            user_id: userId,
            reason: "User not found",
          })
          continue
        }

        // Check if certificate already exists for this user and course
        const existingCert = await db.query(
          "SELECT certificate_id FROM certificates WHERE user_id = $1 AND course_id = $2",
          [userId, course_id],
        )

        if (existingCert.rows.length > 0) {
          results.skipped.push({
            user_id: userId,
            certificate_id: existingCert.rows[0].certificate_id,
            reason: "Certificate already exists",
          })
          continue
        }

        // Generate a unique verification code
        const verificationCode = crypto.randomBytes(16).toString("hex")

        // Insert the certificate
        const insertQuery = `
          INSERT INTO certificates (
            user_id, course_id, template_id, verification_code, 
            issue_date, expiry_date
          )
          VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5)
          RETURNING certificate_id, verification_code
        `

        const result = await db.query(insertQuery, [userId, course_id, template_id, verificationCode, expiry_date])

        results.success.push({
          user_id: userId,
          certificate_id: result.rows[0].certificate_id,
          verification_code: result.rows[0].verification_code,
        })
      } catch (error) {
        console.error(`Error processing user ${userId}:`, error)
        results.failed.push({
          user_id: userId,
          reason: "Processing error",
        })
      }
    }

    // Commit the transaction
    await db.query("COMMIT")

    res.status(200).json({
      message: "Bulk certificate issuance completed",
      results: {
        total: user_ids.length,
        successful: results.success.length,
        failed: results.failed.length,
        skipped: results.skipped.length,
        details: results,
      },
    })
  } catch (error) {
    // Rollback the transaction on error
    await db.query("ROLLBACK")
    console.error("Error in bulk certificate issuance:", error)
    res.status(500).json({ error: "Failed to process bulk certificate issuance" })
  }
}

// Revoke a certificate
const revokeCertificate = async (req, res) => {
  try {
    const { id } = req.params
    const { revocation_reason } = req.body

    // Check if certificate exists
    const certCheck = await db.query("SELECT * FROM certificates WHERE certificate_id = $1", [id])
    if (certCheck.rows.length === 0) {
      return res.status(404).json({ error: "Certificate not found" })
    }

    // Update the certificate
    const updateQuery = `
      UPDATE certificates
      SET is_revoked = true, revocation_reason = $1
      WHERE certificate_id = $2
      RETURNING certificate_id, is_revoked, revocation_reason
    `

    const result = await db.query(updateQuery, [revocation_reason, id])

    res.json({
      certificate: result.rows[0],
      message: "Certificate revoked successfully",
    })
  } catch (error) {
    console.error("Error revoking certificate:", error)
    res.status(500).json({ error: "Failed to revoke certificate" })
  }
}

// Verify a certificate
const verifyCertificate = async (req, res) => {
  try {
    const { code } = req.params

    const query = `
      SELECT 
        c.certificate_id, 
        c.verification_code, 
        c.issue_date, 
        c.expiry_date, 
        c.is_revoked,
        u.first_name, 
        u.last_name, 
        co.title as course_title
      FROM certificates c
      JOIN users u ON c.user_id = u.user_id
      JOIN courses co ON c.course_id = co.course_id
      WHERE c.verification_code = $1
    `

    const result = await db.query(query, [code])

    if (result.rows.length === 0) {
      return res.status(404).json({
        valid: false,
        error: "Certificate not found",
      })
    }

    const cert = result.rows[0]

    // Check if certificate is expired
    const isExpired = cert.expiry_date && new Date(cert.expiry_date) < new Date()

    res.json({
      valid: !cert.is_revoked && !isExpired,
      certificate: {
        certificate_id: cert.certificate_id,
        verification_code: cert.verification_code,
        issue_date: cert.issue_date,
        expiry_date: cert.expiry_date,
        is_revoked: cert.is_revoked,
        is_expired: isExpired,
        student_name: `${cert.first_name} ${cert.last_name}`,
        course_title: cert.course_title,
      },
    })
  } catch (error) {
    console.error("Error verifying certificate:", error)
    res.status(500).json({
      valid: false,
      error: "Failed to verify certificate",
    })
  }
}

// Generate PDF certificate
const generateCertificatePdf = async (req, res) => {
  try {
    const { id } = req.params

    // Get certificate data
    const query = `
      SELECT 
        c.certificate_id, 
        c.verification_code, 
        c.issue_date, 
        c.expiry_date,
        u.first_name, 
        u.last_name, 
        co.title as course_title,
        i.first_name as instructor_first_name,
        i.last_name as instructor_last_name,
        t.html_content,
        t.css_content
      FROM certificates c
      JOIN users u ON c.user_id = u.user_id
      JOIN courses co ON c.course_id = co.course_id
      JOIN users i ON co.instructor_id = i.user_id
      JOIN certificate_templates t ON c.template_id = t.template_id
      WHERE c.certificate_id = $1
    `

    const result = await db.query(query, [id])

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Certificate not found" })
    }

    const cert = result.rows[0]

    // Create a PDF document
    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margin: 0,
    })

    // Set response headers
    res.setHeader("Content-Type", "application/pdf")
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=certificate-${cert.verification_code.substring(0, 8)}.pdf`,
    )

    // Pipe the PDF to the response
    doc.pipe(res)

    // Generate QR code for verification
    const verificationUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/verify-certificate/${cert.verification_code}`
    const qrCodeDataUrl = await QRCode.toDataURL(verificationUrl)

    // Replace template variables with actual data
    const htmlContent = cert.html_content
      .replace(/{{student_name}}/g, `${cert.first_name} ${cert.last_name}`)
      .replace(/{{course_name}}/g, cert.course_title)
      .replace(
        /{{completion_date}}/g,
        new Date(cert.issue_date).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
      )
      .replace(/{{instructor_name}}/g, `${cert.instructor_first_name} ${cert.instructor_last_name}`)
      .replace(/{{verification_code}}/g, cert.verification_code)

    // Add content to PDF
    // This is a simplified approach - in a real implementation, you would render the HTML/CSS properly
    doc
      .font("Helvetica-Bold")
      .fontSize(30)
      .text("Certificate of Completion", { align: "center" })
      .moveDown()
      .font("Helvetica")
      .fontSize(16)
      .text("This is to certify that", { align: "center" })
      .moveDown()
      .font("Helvetica-Bold")
      .fontSize(24)
      .text(`${cert.first_name} ${cert.last_name}`, { align: "center" })
      .moveDown()
      .font("Helvetica")
      .fontSize(16)
      .text("has successfully completed the course", { align: "center" })
      .moveDown()
      .font("Helvetica-Bold")
      .fontSize(20)
      .text(cert.course_title, { align: "center" })
      .moveDown()
      .font("Helvetica")
      .fontSize(14)
      .text(
        `on ${new Date(cert.issue_date).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })}`,
        { align: "center" },
      )
      .moveDown(2)
      .fontSize(12)
      .text(`Instructor: ${cert.instructor_first_name} ${cert.instructor_last_name}`, { align: "center" })
      .moveDown(2)
      .text(`Verification Code: ${cert.verification_code}`, { align: "center" })
      .moveDown()

    // Add QR code
    doc.image(qrCodeDataUrl, doc.page.width / 2 - 50, doc.y, { width: 100 })

    // Finalize the PDF
    doc.end()
  } catch (error) {
    console.error("Error generating certificate PDF:", error)
    res.status(500).json({ error: "Failed to generate certificate PDF" })
  }
}

module.exports = {
  // Template management
  getTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,

  // Certificate management
  getCertificates,
  getCertificateById,
  issueCertificate,
  bulkIssueCertificates, // Add this line
  revokeCertificate,
  verifyCertificate,
  generateCertificatePdf,
}
