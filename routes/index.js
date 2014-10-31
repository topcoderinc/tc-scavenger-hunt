var express = require('express');
var router = express.Router();
var Q = require("q");
var _ = require('lodash');
var request = require("request");
var moment = require("moment");
var User = require('../models/User');
var Step = require('../models/Step');

/* GET home page. */
router.get('/', function(req, res) {
  User.find({totalTime: { $gt: 0 }}, { handle: 1, picture: 1, totalTime: 1} ).sort({ 'totalTime': 1 }).exec(function(err, leaders) {
    res.render('index', {
      title: 'Topcoder Scavenger Hunt',
      leaders: leaders
    });
  });
});

router.post('/start', function(req, res) {
  if (process.env.STATUS === 'open') {
    // see if the user has already started
    User.find({ handle: req.body.handle }, function(error, found) {
      if (found.length) {
        res.json({ message: 'It looks like you have already started the scavenger hunt. cURL /play to continue.' });
      } else {
        request('http://api.topcoder.com/v2/users/' + req.body.handle, function (error, response, body) {
          if (response.statusCode === 200) {
            // create the new user
            var json = JSON.parse(body);
            var user = new User({
              handle: req.body.handle,
              email: req.body.email,
              picture: picture(json.photoLink),
              startDatetime: new Date()
            });
            user.save(function (err, u) {
              if (err) res.json({ message: 'Drat! Looks like there was an error starting the hunt for you.' });
              if (!err) res.json({ message: 'Welcome to the scavenger hunt! You are all set to get started. cURL /play?handle=' + req.body.handle + ' to get your instructions.' });
            });
          } else {
            res.json({ message: 'Could not find a topcoder member with the handle \'' + req.body.handle + '\'. Make sure you register at topcoder.com to play.' });
          }
        });

      }
    });
  } else {
    res.json({ message: 'Sorry! The scavenger hunt is complete. Please watch our twitter feed for the next contest.' });
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
          // add in any penalties
          end.add(req.user.hints * 2, 'minute');
          User.update({ handle: req.user.handle}, {'$set': {
                'complete': true,
                'endDatetime': new Date(),
                'totalTime': Math.round((end.diff(start)/1000)/60 * 100)/100
            }}, function(err) {
            if (err) console.log(err);
          });
          res.json({ message: 'Congratulations! You have completed the scavenger hunt. Check out /leaderbaord to see your results and standings.' });
        }
      });
  }

});

router.post('/submit', function(req, res) {
  var step = currentStep(req.user);
  // prevent them from hitting the submit button twice.
  if (step === undefined) {
    res.json({ message: 'You have already submitted for this step. Please cURL /play again to continue.' });
  } else {
    if (_.indexOf(step.answer, req.body.answer.toLowerCase()) != -1) {
      User.update({ handle: req.user.handle, 'steps.number': req.user.steps.length}, {'$set': {
            'steps.$.complete': true,
            'steps.$.userAnswer': req.body.answer
        }}, function(err) {
        if (err) console.log(err);
      });
      res.json({ success: true, message: 'Correct! Please cURL /play again to continue.' });
    } else {
      res.json({ success: false, message: 'Sorry. That was not the correct answer. You can try a /hint but it will cost you a 2 minute penalty.' });
    }
  }
});

router.get('/hint', function(req, res) {
  // increment the number of hints they requested
  User.update({ handle: req.user.handle}, {'$inc': { 'hints': 1 }}, function(err) {
    if (err) console.log(err);
  });
  var step = currentStep(req.user);
  res.json({ step: step.number, hint: step.hint });
});

router.get('/leaderboard', function(req, res) {
  User.find({totalTime: { $gt: 0 }}, { handle: 1, totalTime: 1} ).sort({ 'totalTime': 1 }).exec(function(err, users) {
    res.json({ leaderboard: users });
  });
});

// TEMP FOR DEVELOPMENT
router.get('/restart', function(req, res) {
  User.remove({ handle : req.user.handle }, function(error, deleted) {
    console.log(deleted);
  });
  res.json({message: req.user.handle + ' deleted.'});
});

// TEMP FOR DEVELOPMENT
router.get('/cheats', function(req, res) {

  // var s = new Step();
  // s.number = 2;
  // s.instructions = "Follow the instructions at http://idolondemand.topcoder.com/#register to signup for an HP IDOL OnDemand API Key. We will be validating these keys with HP so ensure you enter 'topcoder' in the 'how did you hear' box or your submission will be rejected since we will not be able to find it.\nCall the 'Find Related Concepts' API using the text 'topcoder'. Enter the number of 'docs_with_all_terms' for the text 'TopCoder Open' as your anwser.";
  // s.hint = 'You can use their online playground at https://www.idolondemand.com/developer/apis/findrelatedconcepts#try.';
  // s.answer = 'convert Russian literature into binary';
  // s.save();

  Step.find(function(error, allUsers) {
    res.json({users: allUsers});
  });

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

var picture = function(photoLink) {
  if (photoLink.indexOf('http://') === 0) {
    return photoLink;
  } else if (photoLink.indexOf('/') === 0) {
    return 'http://community.topcoder.com' + photoLink;
  } else {
    return 'http://www.topcoder.com/wp-content/themes/tcs-responsive/i/default-photo.png';
  }
};

module.exports = router;
