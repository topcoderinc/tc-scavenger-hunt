var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var db = mongoose.connection;
var User = require('./models/User');

var routes = require('./routes/index');

var app = express();

// connect to mongo
mongoose.connect('mongodb://localhost/scavengerhunt');
// watch for connection notification
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function callback () {
  // console.log('Connected!!');
});

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// find & set the user from their handle
app.use(function (req, res, next) {
  var path = req.path.split('/')[1];
  if (['play','submit','hint','restart','test'].indexOf(path) != -1) {
    if (req.query.handle) {
      User.find({ handle: req.query.handle }, function(error, found) {
        if (found.length) {
          req.user = found[0];
          next();
        } else {
          res.json({ message: 'Handle not found! Make sure you POST to /start first to begin.' });
        }
      });
    } else {
      res.json({ message: 'No handle found!! Make sure you pass your handle on each request: /' + path + '?handle=myhandle' });
    }
  } else { next(); }
})

app.use('/', routes);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});


module.exports = app;
