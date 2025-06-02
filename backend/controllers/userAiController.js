// controllers/userAiController.js
const axios = require("axios")
const db = require("../db")

// Helper function to create a new conversation
const createNewConversation = async (userId, topic = "New conversation") => {
  try {
    const result = await db.query(
      "INSERT INTO ai_conversations (user_id, topic) VALUES ($1, $2) RETURNING conversation_id",
      [userId, topic],
    )
    return result.rows[0].conversation_id
  } catch (error) {
    console.error("Error creating conversation:", error)
    throw error
  }
}

// Get all conversations for a user
exports.getConversations = async (req, res) => {
  try {
    const userId = req.user.user_id

    const result = await db.query("SELECT * FROM ai_conversations WHERE user_id = $1 ORDER BY start_time DESC", [
      userId,
    ])

    return res.status(200).json({
      success: true,
      conversations: result.rows,
    })
  } catch (error) {
    console.error("Error fetching conversations:", error)
    return res.status(500).json({ error: "Failed to fetch conversations" })
  }
}

// Create a new conversation
exports.createConversation = async (req, res) => {
  try {
    const userId = req.user.user_id
    const { topic } = req.body

    const conversationId = await createNewConversation(userId, topic || "New conversation")

    return res.status(201).json({
      success: true,
      conversation_id: conversationId,
    })
  } catch (error) {
    console.error("Error creating conversation:", error)
    return res.status(500).json({ error: "Failed to create conversation" })
  }
}

// Send a message and get AI response
exports.sendMessage = async (req, res) => {
  try {
    const userId = req.user.user_id
    const { message, conversationId, metadata } = req.body

    if (!message || !message.content) {
      return res.status(400).json({ error: "Message content is required" })
    }

    // If no conversation ID provided, create a new conversation
    let activeConversationId = conversationId
    if (!activeConversationId) {
      activeConversationId = await createNewConversation(userId)
    }

    // Store the message in the database
    await db.query("INSERT INTO ai_messages (conversation_id, sender, content) VALUES ($1, $2, $3)", [
      activeConversationId,
      message.sender || "user",
      message.content,
    ])

    // Update message count in conversation
    await db.query("UPDATE ai_conversations SET message_count = message_count + 1 WHERE conversation_id = $1", [
      activeConversationId,
    ])

    // Get conversation history for context (last 10 messages)
    const historyResult = await db.query(
      "SELECT sender, content FROM ai_messages WHERE conversation_id = $1 ORDER BY timestamp DESC LIMIT 10",
      [activeConversationId],
    )

    const conversationHistory = historyResult.rows.reverse()

    // Prepare messages for OpenRouter API
    const messages = []

    // Add a default system prompt if no system message exists in history
    if (!conversationHistory.some((msg) => msg.sender === "system")) {
      // If metadata is provided, create a more specific system prompt
      if (metadata && metadata.scenario && metadata.difficulty) {
        let difficultyInstructions = ""

        // Adjust language complexity based on difficulty level
        if (metadata.difficulty === "beginner") {
          difficultyInstructions =
            "Use simple vocabulary and short sentences. Speak slowly and clearly. Avoid idioms or complex grammar. Repeat important information. Be very patient and encouraging. If the user makes mistakes, provide gentle corrections with simple explanations."
        } else if (metadata.difficulty === "intermediate") {
          difficultyInstructions =
            "Use moderate vocabulary and varied sentence structures. Introduce some common idioms and expressions. Speak at a natural pace. Provide corrections when necessary, but focus on maintaining conversation flow. Challenge the user occasionally with follow-up questions."
        } else if (metadata.difficulty === "advanced") {
          difficultyInstructions =
            "Use rich vocabulary, complex sentences, and natural speech patterns including idioms and colloquialisms. Speak at a normal to fast pace. Focus on nuanced conversation. Only correct significant errors. Challenge the user with complex questions and scenarios that require detailed responses."
        }

        const systemPrompt = `You are an AI assistant acting as a ${metadata.role || "conversation partner"} for a conversational English practice session at ${metadata.difficulty} level.

LANGUAGE LEVEL INSTRUCTIONS:
${difficultyInstructions}

CONVERSATION STYLE:
- Stay in character as a ${metadata.role || "conversation partner"} throughout the entire conversation
- Make the conversation feel natural and realistic, as if it's happening in real life
- Ask questions to keep the conversation going
- Respond to the user's inputs in a way that feels natural
- Include small talk and pleasantries appropriate to the scenario
- Use appropriate emotional responses and conversational fillers
- If the user says something unclear, ask for clarification
- Provide gentle feedback on significant language errors without breaking character too much

Keep your responses concise (2-4 sentences maximum).`

        messages.push({
          role: "system",
          content: systemPrompt,
        })
      } else {
        messages.push({
          role: "system",
          content:
            "You are a helpful AI assistant for language learning. Provide clear, concise responses to help users learn languages effectively.",
        })
      }
    }

    // Add conversation history with validation
    conversationHistory.forEach((msg) => {
      if (typeof msg.content === "string" && msg.content.trim()) {
        messages.push({
          role: msg.sender === "ai" ? "assistant" : msg.sender, // System messages will be sent as "system"
          content: msg.content,
        })
      }
    })

    // Add the current message if it's not already in history
    if (
      typeof message.content === "string" &&
      message.content.trim() &&
      !conversationHistory.some((msg) => msg.sender === message.sender && msg.content === message.content)
    ) {
      messages.push({
        role: message.sender === "ai" ? "assistant" : message.sender,
        content: message.content,
      })
    }

    try {
      // Call OpenRouter API with a more advanced model for better conversation
      const openRouterResponse = await axios.post(
        process.env.OPENROUTER_BASE_URL + "/chat/completions",
        {
          model: "deepseek/deepseek-r1-0528-qwen3-8b:free", // Using a more advanced model for better conversation
          messages: messages,
          temperature: 0.7,
          max_tokens: 1000,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": process.env.OPENROUTER_SITE_URL,
            "X-Title": process.env.OPENROUTER_APP_NAME,
          },
        },
      )

      // Validate API response
      if (
        !openRouterResponse.data ||
        !openRouterResponse.data.choices ||
        !openRouterResponse.data.choices[0] ||
        !openRouterResponse.data.choices[0].message ||
        !openRouterResponse.data.choices[0].message.content
      ) {
        throw new Error("Invalid response from OpenRouter API")
      }

      const aiResponse = openRouterResponse.data.choices[0].message.content

      // Store AI response in database
      await db.query("INSERT INTO ai_messages (conversation_id, sender, content) VALUES ($1, $2, $3)", [
        activeConversationId,
        "ai",
        aiResponse,
      ])

      // Update message count in conversation
      await db.query("UPDATE ai_conversations SET message_count = message_count + 1 WHERE conversation_id = $1", [
        activeConversationId,
      ])

      return res.status(200).json({
        success: true,
        content: aiResponse,
        conversation_id: activeConversationId,
      })
    } catch (error) {
      console.error("OpenRouter API error:", error.response?.data || error.message)

      // Check for specific error types
      if (error.response) {
        if (error.response.status === 402) {
          await db.query("INSERT INTO ai_messages (conversation_id, sender, content) VALUES ($1, $2, $3)", [
            activeConversationId,
            "system",
            "Insufficient credits in OpenRouter account.",
          ])

          return res.status(402).json({
            error: "Insufficient credits in OpenRouter account. Please contact administrator to add more credits.",
            errorCode: "INSUFFICIENT_CREDITS",
          })
        } else if (error.response.status === 429) {
          return res.status(429).json({
            error: "Rate limit exceeded. Please try again later.",
            errorCode: "RATE_LIMIT_EXCEEDED",
          })
        } else if (error.response.status === 400) {
          return res.status(400).json({
            error: "Bad request to AI service. Please check your input and try again.",
            errorCode: "BAD_REQUEST",
            details: error.response.data || error.message,
          })
        }
      }

      // Generic error
      return res.status(500).json({
        error: "Failed to get AI response. Please try again.",
        errorCode: "AI_SERVICE_ERROR",
        details: error.message,
      })
    }
  } catch (error) {
    console.error("Error in sendMessage:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
}

// Get messages of a conversation
exports.getConversationMessages = async (req, res) => {
  try {
    const userId = req.user.user_id
    const { conversationId } = req.params

    // Check if conversation exists and belongs to user
    const conversationResult = await db.query(
      "SELECT * FROM ai_conversations WHERE conversation_id = $1 AND user_id = $2",
      [conversationId, userId],
    )

    if (conversationResult.rows.length === 0) {
      return res.status(404).json({ error: "Conversation not found" })
    }

    // Get messages
    const messagesResult = await db.query(
      "SELECT * FROM ai_messages WHERE conversation_id = $1 ORDER BY timestamp ASC",
      [conversationId],
    )

    return res.status(200).json({
      success: true,
      conversation: conversationResult.rows[0],
      messages: messagesResult.rows,
    })
  } catch (error) {
    console.error("Error fetching conversation messages:", error)
    return res.status(500).json({ error: "Failed to fetch conversation messages" })
  }
}

// Update conversation name
exports.updateConversation = async (req, res) => {
  try {
    const userId = req.user.user_id
    const { conversationId } = req.params
    const { topic } = req.body

    if (!topic) {
      return res.status(400).json({ error: "Topic is required" })
    }

    // Check if conversation exists and belongs to user
    const conversationResult = await db.query(
      "SELECT * FROM ai_conversations WHERE conversation_id = $1 AND user_id = $2",
      [conversationId, userId],
    )

    if (conversationResult.rows.length === 0) {
      return res.status(404).json({ error: "Conversation not found" })
    }

    // Update conversation
    await db.query("UPDATE ai_conversations SET topic = $1 WHERE conversation_id = $2", [topic, conversationId])

    return res.status(200).json({
      success: true,
      message: "Conversation updated successfully",
    })
  } catch (error) {
    console.error("Error updating conversation:", error)
    return res.status(500).json({ error: "Failed to update conversation" })
  }
}

// Delete a conversation
exports.deleteConversation = async (req, res) => {
  try {
    const userId = req.user.user_id
    const { conversationId } = req.params

    // Check if conversation exists and belongs to user
    const conversationResult = await db.query(
      "SELECT * FROM ai_conversations WHERE conversation_id = $1 AND user_id = $2",
      [conversationId, userId],
    )

    if (conversationResult.rows.length === 0) {
      return res.status(404).json({ error: "Conversation not found" })
    }

    // Delete conversation (messages will be deleted by CASCADE)
    await db.query("DELETE FROM ai_conversations WHERE conversation_id = $1", [conversationId])

    return res.status(200).json({
      success: true,
      message: "Conversation deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting conversation:", error)
    return res.status(500).json({ error: "Failed to delete conversation" })
  }
}

// Rate a conversation
exports.rateConversation = async (req, res) => {
  try {
    const userId = req.user.user_id
    const { conversationId } = req.params
    const { rating, isResolved } = req.body

    if (!rating || !["positive", "neutral", "negative"].includes(rating)) {
      return res.status(400).json({ error: "Valid rating is required" })
    }

    // Check if conversation exists and belongs to user
    const conversationResult = await db.query(
      "SELECT * FROM ai_conversations WHERE conversation_id = $1 AND user_id = $2",
      [conversationId, userId],
    )

    if (conversationResult.rows.length === 0) {
      return res.status(404).json({ error: "Conversation not found" })
    }

    // Update conversation
    await db.query(
      "UPDATE ai_conversations SET satisfaction_rating = $1, is_resolved = $2 WHERE conversation_id = $3",
      [rating, isResolved || false, conversationId],
    )

    return res.status(200).json({
      success: true,
      message: "Feedback submitted successfully",
    })
  } catch (error) {
    console.error("Error submitting feedback:", error)
    return res.status(500).json({ error: "Failed to submit feedback" })
  }
}
