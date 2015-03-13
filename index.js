'use strict';

var express = require('express');
var passport = require('passport');
var request = require('request');
var swig = require('swig');
var TwentyThreeAndMeStrategy = require('passport-23andme').Strategy;

require('express-csv');

var API_URL = 'https://api.23andme.com/1';

function api(url, accessToken, optionalCallback) {
  if (!optionalCallback) {
    optionalCallback = function () {};
  }

  return request.get({
    url: API_URL + url,
    headers: {
      Authorization: 'Bearer ' + accessToken
    },
    json: true
  }, optionalCallback);
}

swig.setDefaults({
  // Swig's caching
  cache: false
});

var app = express();

app.engine('html', swig.renderFile);

app.set('view engine', 'html');
app.set('views', __dirname + '/views');
//app.set('view options', { layout: false });
// Express' own caching
app.set('view cache', false);

app.use(express.logger());

app.use(express.static(__dirname + '/public'));
app.use('/bower', express.static(__dirname + '/bower_components'));

app.use(express.favicon());
app.use(express.cookieParser());
app.use(express.urlencoded());
app.use(express.json());
app.use(express.session({secret: process.env.SESSION_SECRET}));

app.use(passport.initialize());
app.use(passport.session());

app.use(app.router);

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }

  res.redirect('/23andme/auth');
}

passport.serializeUser(function (user, done) {
  done(null, user);
});

passport.deserializeUser(function (obj, done) {
  done(null, obj);
});

passport.use(new TwentyThreeAndMeStrategy({
    callbackURL: process.env.CALLBACK_URL,
    clientID: process.env.TTANDME_CONSUMER_KEY,
    clientSecret: process.env.TTANDME_CONSUMER_SECRET,
    scope: 'basic names haplogroups ancestry analyses',
    skipUserProfile: true
  },
  function (accessToken, refreshToken, profile, done) {
    if (!profile) {
      profile = {};
    }

    profile.accessToken = accessToken;
    profile.refreshToken = refreshToken;

    api('/names/', accessToken, function (err, response, body) {
      if (err) {
        console.error(err);
      }

      profile.profiles = body.profiles;

      done(null, profile);
    });
  }
));

app.get('/', function (req, res) {
  res.render('index', {user: req.user});
});

app.all('/data/*', ensureAuthenticated);

app.get('/data/:type/:profile/json', function (req, res) {
  api('/' + req.param('type') + '/' + req.param('profile') + '/',
    req.user.accessToken).pipe(res);
});

function genericTraitCSV(req, res) {
  api('/' + req.param('type') + '/' + req.param('profile') + '/',
    req.user.accessToken, function (err, response, body) {
      if (err || !body) {
        return res.send(err);
      }

      var keys = Object.keys(body.traits[0]);

      var headers = {};

      keys.forEach(function (key) {
        headers[key] = key;
      });

      res.set('Content-Disposition', 'attachment; filename=' +
        req.param('type') + '.csv');

      res.csv([headers].concat(body.traits));
    });
}

app.get('/data/:type/:profile', genericTraitCSV);

app.get('/auth', passport.authenticate('23andme'));

app.get('/auth/callback',
  passport.authenticate('23andme', {
    failureRedirect: '/23andme/auth'
  }), function (req, res) {
    res.redirect('/23andme/');
  });

app.get('/session', function (req, res) {
  if (!req.session.accessToken) {
    return res.redirect('/23andme/auth');
  }

  res.json({
    session: req.session,
    user: req.user
  });
});

app.get('/logout', function (req, res) {
  req.logout();
  res.redirect('/23andme/');
});

app.listen(process.env.PORT);
