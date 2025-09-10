// models/Event.js
const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [100, 'Title cannot be more than 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: [1000, 'Description cannot be more than 1000 characters']
  },
  prizeMoney: {
    first: {
      type: Number,
      required: [true, 'First prize is required'],
      min: [0, 'Prize money cannot be negative']
    },
    second: {
      type: Number,
      required: [true, 'Second prize is required'],
      min: [0, 'Prize money cannot be negative']
    },
    third: {
      type: Number,
      required: [true, 'Third prize is required'],
      min: [0, 'Prize money cannot be negative']
    }
  },
  dateTime: {
    type: Date,
    required: [true, 'Date and time is required'],
    validate: {
      validator: function(value) {
        return value > new Date();
      },
      message: 'Event date must be in the future'
    }
  },
  venue: {
    type: String,
    required: [true, 'Venue is required'],
    trim: true,
    maxlength: [200, 'Venue cannot be more than 200 characters']
  },
  eventType: {
    type: String,
    required: [true, 'Event type is required'],
    enum: {
      values: ['Technical', 'Cultural', 'Sports', 'Academic', 'Literary', 'Art', 'Music', 'Dance'],
      message: '{VALUE} is not a valid event type'
    }
  },
  maxTeamSize: {
    type: Number,
    required: [true, 'Max team size is required'],
    min: [1, 'Team size must be at least 1'],
    max: [50, 'Team size cannot exceed 50']
  }
}, {
  timestamps: true, // This adds createdAt and updatedAt automatically
  toJSON: { 
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Create indexes for better performance
eventSchema.index({ eventType: 1 });
eventSchema.index({ dateTime: 1 });
eventSchema.index({ createdAt: -1 });

// Pre-save middleware
eventSchema.pre('save', function(next) {
  // Convert title to title case
  this.title = this.title.replace(/\w\S*/g, (txt) => {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
  next();
});

// Instance method to get total prize money
eventSchema.methods.getTotalPrizeMoney = function() {
  return this.prizeMoney.first + this.prizeMoney.second + this.prizeMoney.third;
};

// Static method to get events by type
eventSchema.statics.getByType = function(eventType) {
  return this.find({ eventType }).sort({ dateTime: 1 });
};

const Event = mongoose.model('Event', eventSchema);

module.exports = Event;