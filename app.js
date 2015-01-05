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
app.set('port', process.env.PORT || 3000);

// connect to mongo
mongoose.connect(process.env.MONGOLAB_URI|| 'mongodb://localhost/scavengerhunt');
// watch for connection notification
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function callback () {
  // console.log('Connected!!');
});

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hjs');

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
  if (['play','submit','hint','restart'].indexOf(path) != -1) {
    if (req.query.handle && req.query.key) {
      User.find({ handle: req.query.handle, key: req.query.key }, function(error, found) {
        if (found.length) {
          req.user = found[0];
          next();
        } else {
          res.json({ message: 'Handle/key combination not found! If you have not registered yet, make sure you POST to /start first to begin. See the home page for instructions.' });
        }
      });
    } else {
      res.json({ message: 'Handle and/or key not present!! Make sure you pass your handle and key on each request: /' + path + '?handle=myhandle&key=mykey' });
    }
  } else { next(); }
});

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

var server = app.listen(app.get('port'), function() {
  console.log('Express server listening on port ' + server.address().port);
});

module.exports = app;
