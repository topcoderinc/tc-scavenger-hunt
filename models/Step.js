var mongoose = require('mongoose');

var stepSchema = new mongoose.Schema({
  number: Number,
  instructions: String,
  hint: String,
  answer: String,
  userAnswer: String,
  complete: { type: Boolean, default: false }
});

module.exports = mongoose.model('Step', stepSchema);
