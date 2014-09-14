var mongoose = require('mongoose');
var StepSchema = require('../models/Step').Schema;

var userSchema = new mongoose.Schema({
  handle: String,
  email: String,
  steps: [StepSchema],
  startDatetime: { type: Date, default: new Date()},
  endDatetime: Date,
  totalTime: Number,
  complete: { type: Boolean, default: false }
});

module.exports = mongoose.model('User', userSchema);
