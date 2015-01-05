var mongoose = require('mongoose');
var StepSchema = require('../models/Step').Schema;

var userSchema = new mongoose.Schema({
  handle: String,
  email: String,
  key: Number,
  picture: { type: String, default: 'http://www.topcoder.com/wp-content/themes/tcs-responsive/i/default-photo.png' },
  steps: [StepSchema],
  hints: { type: Number, default: 0},
  startDatetime: { type: Date, default: new Date()},
  endDatetime: Date,
  totalTime: Number,
  complete: { type: Boolean, default: false }
});

module.exports = mongoose.model('User', userSchema);
