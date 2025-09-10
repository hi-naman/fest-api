// server.js
const express = require('express');
const cors = require('cors');
const { body, validationResult, param } = require('express-validator');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage (replace with database in production)
let events = [];
let nextId = 1;

// Validation middleware
const validateEvent = [
  body('title').notEmpty().withMessage('Title is required'),
  body('description').notEmpty().withMessage('Description is required'),
  body('prizeMoney.first').isNumeric().withMessage('First prize must be a number'),
  body('prizeMoney.second').isNumeric().withMessage('Second prize must be a number'),
  body('prizeMoney.third').isNumeric().withMessage('Third prize must be a number'),
  body('dateTime').isISO8601().withMessage('Date and time must be in ISO format'),
  body('venue').notEmpty().withMessage('Venue is required'),
  body('eventType').notEmpty().withMessage('Event type is required'),
  body('maxTeamSize').isInt({ min: 1 }).withMessage('Max team size must be a positive integer')
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

// Routes

// GET /api/events - Get all events
app.get('/api/events', (req, res) => {
  res.json({
    success: true,
    message: 'Events retrieved successfully',
    data: events,
    count: events.length
  });
});

// GET /api/events/:id - Get single event by ID
app.get('/api/events/:id', [
  param('id').isInt().withMessage('ID must be an integer')
], handleValidationErrors, (req, res) => {
  const eventId = parseInt(req.params.id);
  const event = events.find(e => e.id === eventId);
  
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
});

// POST /api/events - Create new event
app.post('/api/events', validateEvent, handleValidationErrors, (req, res) => {
  const {
    title,
    description,
    prizeMoney,
    dateTime,
    venue,
    eventType,
    maxTeamSize
  } = req.body;

  const newEvent = {
    id: nextId++,
    title,
    description,
    prizeMoney: {
      first: parseFloat(prizeMoney.first),
      second: parseFloat(prizeMoney.second),
      third: parseFloat(prizeMoney.third)
    },
    dateTime: new Date(dateTime),
    venue,
    eventType,
    maxTeamSize: parseInt(maxTeamSize),
    createdAt: new Date(),
    updatedAt: new Date()
  };

  events.push(newEvent);

  res.status(201).json({
    success: true,
    message: 'Event created successfully',
    data: newEvent
  });
});

// PUT /api/events/:id - Update entire event
app.put('/api/events/:id', [
  param('id').isInt().withMessage('ID must be an integer'),
  ...validateEvent
], handleValidationErrors, (req, res) => {
  const eventId = parseInt(req.params.id);
  const eventIndex = events.findIndex(e => e.id === eventId);
  
  if (eventIndex === -1) {
    return res.status(404).json({
      success: false,
      message: 'Event not found'
    });
  }

  const {
    title,
    description,
    prizeMoney,
    dateTime,
    venue,
    eventType,
    maxTeamSize
  } = req.body;

  const updatedEvent = {
    ...events[eventIndex],
    title,
    description,
    prizeMoney: {
      first: parseFloat(prizeMoney.first),
      second: parseFloat(prizeMoney.second),
      third: parseFloat(prizeMoney.third)
    },
    dateTime: new Date(dateTime),
    venue,
    eventType,
    maxTeamSize: parseInt(maxTeamSize),
    updatedAt: new Date()
  };

  events[eventIndex] = updatedEvent;

  res.json({
    success: true,
    message: 'Event updated successfully',
    data: updatedEvent
  });
});

// PATCH /api/events/:id - Partial update of event
app.patch('/api/events/:id', [
  param('id').isInt().withMessage('ID must be an integer'),
  body('title').optional().notEmpty().withMessage('Title cannot be empty if provided'),
  body('description').optional().notEmpty().withMessage('Description cannot be empty if provided'),
  body('prizeMoney.first').optional().isNumeric().withMessage('First prize must be a number'),
  body('prizeMoney.second').optional().isNumeric().withMessage('Second prize must be a number'),
  body('prizeMoney.third').optional().isNumeric().withMessage('Third prize must be a number'),
  body('dateTime').optional().isISO8601().withMessage('Date and time must be in ISO format'),
  body('venue').optional().notEmpty().withMessage('Venue cannot be empty if provided'),
  body('eventType').optional().notEmpty().withMessage('Event type cannot be empty if provided'),
  body('maxTeamSize').optional().isInt({ min: 1 }).withMessage('Max team size must be a positive integer')
], handleValidationErrors, (req, res) => {
  const eventId = parseInt(req.params.id);
  const eventIndex = events.findIndex(e => e.id === eventId);
  
  if (eventIndex === -1) {
    return res.status(404).json({
      success: false,
      message: 'Event not found'
    });
  }

  const updateFields = req.body;
  const currentEvent = events[eventIndex];

  // Update only provided fields
  const updatedEvent = {
    ...currentEvent,
    ...updateFields,
    updatedAt: new Date()
  };

  // Handle prize money updates properly
  if (updateFields.prizeMoney) {
    updatedEvent.prizeMoney = {
      ...currentEvent.prizeMoney,
      ...updateFields.prizeMoney
    };
  }

  // Convert date string to Date object if provided
  if (updateFields.dateTime) {
    updatedEvent.dateTime = new Date(updateFields.dateTime);
  }

  // Convert maxTeamSize to integer if provided
  if (updateFields.maxTeamSize) {
    updatedEvent.maxTeamSize = parseInt(updateFields.maxTeamSize);
  }

  events[eventIndex] = updatedEvent;

  res.json({
    success: true,
    message: 'Event updated successfully',
    data: updatedEvent
  });
});

// DELETE /api/events/:id - Delete event
app.delete('/api/events/:id', [
  param('id').isInt().withMessage('ID must be an integer')
], handleValidationErrors, (req, res) => {
  const eventId = parseInt(req.params.id);
  const eventIndex = events.findIndex(e => e.id === eventId);
  
  if (eventIndex === -1) {
    return res.status(404).json({
      success: false,
      message: 'Event not found'
    });
  }

  const deletedEvent = events.splice(eventIndex, 1)[0];

  res.json({
    success: true,
    message: 'Event deleted successfully',
    data: deletedEvent
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is running successfully',
    timestamp: new Date(),
    version: '1.0.0'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
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
  console.log(`Server is running on port ${PORT}`);
  console.log(`API Base URL: http://localhost:${PORT}/api`);
});

module.exports = app;