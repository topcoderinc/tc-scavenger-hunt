var express = require('express');
var router = express.Router();
var Q = require("q");
var moment = require("moment");
var User = require('../models/User');
var Step = require('../models/Step');

/* GET home page. */
router.get('/', function(req, res) {
  User.find({totalTime: { $gt: 0 }}, { handle: 1, totalTime: 1} ).sort({ 'totalTime': 1 }).exec(function(err, users) {

    res.render('index', {
      title: 'Topcoder Scavenger Hunt',
      leaderboard: users
    });
  });
});

router.post('/start', function(req, res) {
  // see if the user has already started
  User.find({ handle: req.body.handle }, function(error, found) {
    if (found.length) {
      res.json({ message: 'It looks like you have already started the scavenger hunt. cURL /play to continue.' });
    } else {
      // create the new user
      var user = new User({handle: req.body.handle, email: req.body.email});
      user.save(function (err, u) {
        if (err) res.json({ message: 'Drat! Looks like there was an error starting the hunt for you.' });
        if (!err) res.json({ message: 'Excellent! You are all set for the scavenger hunt. cURL /play to get started.' });
      });
    }
  });
});

router.post('/submit', function(req, res) {
  var step = currentStep(req.user);
  // prevent them from hitting the submit button twice.
  if (step === undefined) {
    res.json({ message: 'You have already submitted for this step. Please cURL /play again to continue.' });
  } else {
    if (step.answer.toLowerCase() === req.body.answer.toLowerCase()) {
      User.update({ handle: req.user.handle, 'steps.number': req.user.steps.length}, {'$set': {
            'steps.$.complete': true,
            'steps.$.userAnswer': req.body.answer
        }}, function(err) {
        if (err) console.log(err);
      });
      res.json({ success: true, message: 'Correct! Please cURL /play again to continue.' });
    } else {
      res.json({ success: false, message: 'Sorry. That was not the correct answer.' });
    }
  }
});

router.get('/play', function(req, res) {
  var step = currentStep(req.user);
  // if they have an un-completed step, show it to them
  if (step) {
    res.json({ step: step.number, instructions: step.instructions });
  // no un-completed step, so go find the next step
  } else {
    // if they don't have an incomplete step, get the next one
    var nextStep = req.user.steps.length + 1;
    randomStep(nextStep)
      .then(function(step) {
        // if we found a next step, save it for them and show it
        if (step) {
          res.json({ step: step.number, instructions: step.instructions });
          // save this step for the user
          req.user.steps.push(step);
          req.user.save();
        } else {
          var start = moment(req.user.startDatetime);
          var end = moment(new Date());
          User.update({ handle: req.user.handle}, {'$set': {
                'complete': true,
                'endDatetime': new Date(),
                'totalTime': Math.round((end.diff(start)/1000)/60 * 100)/100
            }}, function(err) {
            if (err) console.log(err);
          });
          res.json({ message: 'All done!!' });
        }
      });
  }

});

router.get('/hint', function(req, res) {
  var step = currentStep(req.user);
  res.json({ step: step.number, hint: step.hint });
});

router.get('/help', function(req, res) {
  res.json({ message: 'Call Ghost Busters.' });
});

router.get('/restart', function(req, res) {
  User.remove({ handle : req.user.handle }, function(error, deleted) {
    console.log(deleted);
  });
  res.json({message: req.user.handle + ' deleted.'});
});

// TEMP FOR DEVELOPMENT
router.get('/users', function(req, res) {

  User.find(function(error, allUsers) {
    res.json({users: allUsers});
  });

});

// TEMP FOR DEVELOPMENT
router.get('/test', function(req, res) {

  var s = new Step();
  s.number = 3;
  s.instructions = "Solve this algorithm..... Call the method with the following array: [1, 2]. Enter the resulting number as your answer.";
  s.hint = 'Use the following inputs...';
  s.answer = '3';
  s.save();

  res.json({user: req.user});
});

var currentStep = function(user) {
  for (i = 0; i < user.steps.length; i++) {
    if (user.steps[i].complete === false) {
      return user.steps[i];
    }
  }
};

var randomStep = function(stepNumber) {
  var deferred = Q.defer();
  Step.count({ number: stepNumber }, function(err, ct) {
    var r = Math.floor(Math.random() * ct);
    // get a random step #1
    Step.find({ number: stepNumber }).limit(1).skip(r).exec(function(err, step) {
      if (err) deferred.reject(err);
      if (!err) deferred.resolve(step[0]);
    });
  });
  return deferred.promise;
};

module.exports = router;
