// server.js
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { body, validationResult, param } = require('express-validator');
const connectDB = require('./config/database');
const Event = require('./models/Event');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Validation middleware
const validateEvent = [
  body('title').notEmpty().withMessage('Title is required').trim(),
  body('description').notEmpty().withMessage('Description is required').trim(),
  body('prizeMoney.first').isNumeric().withMessage('First prize must be a number'),
  body('prizeMoney.second').isNumeric().withMessage('Second prize must be a number'),
  body('prizeMoney.third').isNumeric().withMessage('Third prize must be a number'),
  body('dateTime').isISO8601().withMessage('Date and time must be in ISO format'),
  body('venue').notEmpty().withMessage('Venue is required').trim(),
  body('eventType').notEmpty().withMessage('Event type is required').isIn(['Technical', 'Cultural', 'Sports', 'Academic', 'Literary', 'Art', 'Music', 'Dance']).withMessage('Invalid event type'),
  body('maxTeamSize').isInt({ min: 1, max: 50 }).withMessage('Max team size must be between 1 and 50')
];

// Helper function to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation errors',
      errors: errors.array()
    });
  }
  next();
};

// Helper function to handle async errors
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Routes

// GET /api/events - Get all events with optional filtering and pagination
app.get('/api/events', asyncHandler(async (req, res) => {
  try {
    const { eventType, page = 1, limit = 50, sortBy = 'dateTime', order = 'asc' } = req.query;
    
    // Build filter object
    const filter = {};
    if (eventType) {
      filter.eventType = eventType;
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = order === 'desc' ? -1 : 1;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get events with pagination
    const events = await Event.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination info
    const totalEvents = await Event.countDocuments(filter);
    const totalPages = Math.ceil(totalEvents / parseInt(limit));

    res.json({
      success: true,
      message: 'Events retrieved successfully',
      data: events,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalEvents,
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving events',
      error: error.message
    });
  }
}));

// GET /api/events/stats - Get event statistics
app.get('/api/events/stats', asyncHandler(async (req, res) => {
  try {
    const stats = await Event.aggregate([
      {
        $group: {
          _id: null,
          totalEvents: { $sum: 1 },
          totalPrizeMoney: {
            $sum: {
              $add: ['$prizeMoney.first', '$prizeMoney.second', '$prizeMoney.third']
            }
          },
          avgPrizeMoney: {
            $avg: {
              $add: ['$prizeMoney.first', '$prizeMoney.second', '$prizeMoney.third']
            }
          },
          eventTypes: { $addToSet: '$eventType' }
        }
      }
    ]);

    const eventTypeStats = await Event.aggregate([
      {
        $group: {
          _id: '$eventType',
          count: { $sum: 1 },
          totalPrize: {
            $sum: {
              $add: ['$prizeMoney.first', '$prizeMoney.second', '$prizeMoney.third']
            }
          }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      message: 'Statistics retrieved successfully',
      data: {
        overview: stats[0] || { totalEvents: 0, totalPrizeMoney: 0, avgPrizeMoney: 0, eventTypes: [] },
        byEventType: eventTypeStats
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving statistics',
      error: error.message
    });
  }
}));

// GET /api/events/:id - Get single event by ID
app.get('/api/events/:id', [
  param('id').isMongoId().withMessage('Invalid event ID')
], handleValidationErrors, asyncHandler(async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Event retrieved successfully',
      data: event
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving event',
      error: error.message
    });
  }
}));

// POST /api/events - Create new event
app.post('/api/events', validateEvent, handleValidationErrors, asyncHandler(async (req, res) => {
  try {
    const eventData = {
      title: req.body.title,
      description: req.body.description,
      prizeMoney: {
        first: parseFloat(req.body.prizeMoney.first),
        second: parseFloat(req.body.prizeMoney.second),
        third: parseFloat(req.body.prizeMoney.third)
      },
      dateTime: new Date(req.body.dateTime),
      venue: req.body.venue,
      eventType: req.body.eventType,
      maxTeamSize: parseInt(req.body.maxTeamSize)
    };

    const newEvent = await Event.create(eventData);

    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      data: newEvent
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message
      }));
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error creating event',
      error: error.message
    });
  }
}));

// PUT /api/events/:id - Update entire event
app.put('/api/events/:id', [
  param('id').isMongoId().withMessage('Invalid event ID'),
  ...validateEvent
], handleValidationErrors, asyncHandler(async (req, res) => {
  try {
    const updateData = {
      title: req.body.title,
      description: req.body.description,
      prizeMoney: {
        first: parseFloat(req.body.prizeMoney.first),
        second: parseFloat(req.body.prizeMoney.second),
        third: parseFloat(req.body.prizeMoney.third)
      },
      dateTime: new Date(req.body.dateTime),
      venue: req.body.venue,
      eventType: req.body.eventType,
      maxTeamSize: parseInt(req.body.maxTeamSize)
    };

    const updatedEvent = await Event.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!updatedEvent) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    res.json({
      success: true,
      message: 'Event updated successfully',
      data: updatedEvent
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message
      }));
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error updating event',
      error: error.message
    });
  }
}));

// PATCH /api/events/:id - Partial update of event
app.patch('/api/events/:id', [
  param('id').isMongoId().withMessage('Invalid event ID'),
  body('title').optional().notEmpty().withMessage('Title cannot be empty if provided').trim(),
  body('description').optional().notEmpty().withMessage('Description cannot be empty if provided').trim(),
  body('prizeMoney.first').optional().isNumeric().withMessage('First prize must be a number'),
  body('prizeMoney.second').optional().isNumeric().withMessage('Second prize must be a number'),
  body('prizeMoney.third').optional().isNumeric().withMessage('Third prize must be a number'),
  body('dateTime').optional().isISO8601().withMessage('Date and time must be in ISO format'),
  body('venue').optional().notEmpty().withMessage('Venue cannot be empty if provided').trim(),
  body('eventType').optional().isIn(['Technical', 'Cultural', 'Sports', 'Academic', 'Literary', 'Art', 'Music', 'Dance']).withMessage('Invalid event type'),
  body('maxTeamSize').optional().isInt({ min: 1, max: 50 }).withMessage('Max team size must be between 1 and 50')
], handleValidationErrors, asyncHandler(async (req, res) => {
  try {
    const updateFields = { ...req.body };
    
    // Handle nested prize money updates
    if (updateFields.prizeMoney) {
      Object.keys(updateFields.prizeMoney).forEach(key => {
        if (updateFields.prizeMoney[key] !== undefined) {
          updateFields[`prizeMoney.${key}`] = parseFloat(updateFields.prizeMoney[key]);
        }
      });
      delete updateFields.prizeMoney;
    }

    // Convert date string if provided
    if (updateFields.dateTime) {
      updateFields.dateTime = new Date(updateFields.dateTime);
    }

    // Convert maxTeamSize if provided
    if (updateFields.maxTeamSize) {
      updateFields.maxTeamSize = parseInt(updateFields.maxTeamSize);
    }

    const updatedEvent = await Event.findByIdAndUpdate(
      req.params.id,
      { $set: updateFields },
      { new: true, runValidators: true }
    );
    
    if (!updatedEvent) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    res.json({
      success: true,
      message: 'Event updated successfully',
      data: updatedEvent
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message
      }));
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error updating event',
      error: error.message
    });
  }
}));

// DELETE /api/events/:id - Delete event
app.delete('/api/events/:id', [
  param('id').isMongoId().withMessage('Invalid event ID')
], handleValidationErrors, asyncHandler(async (req, res) => {
  try {
    const deletedEvent = await Event.findByIdAndDelete(req.params.id);
    
    if (!deletedEvent) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    res.json({
      success: true,
      message: 'Event deleted successfully',
      data: deletedEvent
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting event',
      error: error.message
    });
  }
}));

// DELETE /api/events - Delete all events (for testing purposes)
app.delete('/api/events', asyncHandler(async (req, res) => {
  try {
    const result = await Event.deleteMany({});
    
    res.json({
      success: true,
      message: `${result.deletedCount} events deleted successfully`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting events',
      error: error.message
    });
  }
}));

// Health check endpoint
app.get('/api/health', asyncHandler(async (req, res) => {
  try {
    // Check database connection
    const dbStatus = mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected';
    const eventCount = await Event.countDocuments();
    
    res.json({
      success: true,
      message: 'API is running successfully',
      timestamp: new Date(),
      version: '2.0.0',
      database: {
        status: dbStatus,
        name: mongoose.connection.name,
        eventCount
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Health check failed',
      error: error.message
    });
  }
}));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format',
      error: 'Invalid ID'
    });
  }

  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors
    });
  }

  res.status(500).json({
    success: false,
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📡 API Base URL: http://localhost:${PORT}/api`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;