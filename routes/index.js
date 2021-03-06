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
  // res.redirect('http://hphaven.topcoder.com/scavenger-hunt');
  User.find({totalTime: { $gt: 0 }}, { handle: 1, picture: 1, totalTime: 1} ).sort({ 'totalTime': 1 }).exec(function(err, leaders) {
    res.render('index', {
      title: 'Topcoder Scavenger Hunt',
      leaders: leaders,
      open: process.env.STATUS === 'open' ? true : false
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
            var json = JSON.parse(body);
            if (req.body.handle === json.handle) {
              // create the new user
              var user = new User({
                handle: req.body.handle,
                key: randomInt(1,100000),
                picture: picture(json.photoLink),
                startDatetime: new Date()
              });
              user.save(function (err, u) {
                if (err) res.json({ message: 'Drat! Looks like there was an error starting the hunt for you.' });
                if (!err) res.json({ message: 'Welcome to the scavenger hunt! You are all set to get started. cURL /play?handle=' + req.body.handle + '&key=' + user.key + ' to get your instructions. Ensure you pass your handle and key when required. Please do not lose your key. There is no way to recover it.' });
              });
            } else {
              res.json({ message: 'Could not find a topcoder member with the handle \'' + req.body.handle + '\'. Make sure you register at topcoder.com to play and enter your handle with any upper or lower case characters.' });
            }
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
  if (process.env.STATUS === 'open') {

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

  } else {
    res.json({ message: 'Sorry! The scavenger hunt is complete. Please watch our twitter feed for the next contest.' });
  }

});

router.post('/submit', function(req, res) {
  if (process.env.STATUS === 'open') {

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
        console.log(req.user.handle + ' answered incorrectly with: |' + req.body.answer + '|. Correct answer is:' + step.answer);
        res.json({ success: false, message: 'Sorry. That was not the correct answer. Make sure you URL encode any text for you answer that contains spaces. You can try a /hint but it will cost you a 2 minute penalty.' });
      }
    }

  } else {
    res.json({ message: 'Sorry! The scavenger hunt is complete. Please watch our twitter feed for the next contest.' });
  }

});

router.get('/hint', function(req, res) {
  if (process.env.STATUS === 'open') {

    // increment the number of hints they requested
    User.update({ handle: req.user.handle}, {'$inc': { 'hints': 1 }}, function(err) {
      if (err) console.log(err);
    });
    var step = currentStep(req.user);
    res.json({ step: step.number, hint: step.hint });

  } else {
    res.json({ message: 'Sorry! The scavenger hunt is complete. Please watch our twitter feed for the next contest.' });
  }

});

router.get('/leaderboard', function(req, res) {
  if (process.env.STATUS === 'open') {

    User.find({totalTime: { $gt: 0 }}, { handle: 1, totalTime: 1, picture: 1} ).sort({ 'totalTime': 1 }).exec(function(err, users) {
      res.json({ leaderboard: users });
    });

  } else {
    res.json({ message: 'Sorry! The scavenger hunt is complete. Please watch our twitter feed for the next contest.' });
  }

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
  Step.count({ number: stepNumber, active: true }, function(err, ct) {
    var r = Math.floor(Math.random() * ct);
    // get a random question for the step
    Step.find({ number: stepNumber, active: true }).limit(1).skip(r).exec(function(err, step) {
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

function randomInt (low, high) {
  return Math.floor(Math.random() * (high - low) + low);
}

module.exports = router;
