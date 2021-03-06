'use strict';

const express = require('express');
var cors = require('cors');
const path = require('path');
const axios = require('axios');
const router = express.Router();
const expressEjsLayout = require('express-ejs-layouts')
const flash = require('connect-flash');
const session = require('express-session');
const passport = require("passport");

require('./config/passport')(passport)

const PORT = 80;
const HOST = '0.0.0.0';

const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(cors());

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({extended : false}));

app.use(session({
    secret : 'secret',
    resave : true,
    saveUninitialized : true
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(flash());
app.use((req,res,next)=> {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.error  = req.flash('error');
    next();
});


app.use('/',require('./routes/index'));
app.use('/users',require('./routes/users'));

app.listen(PORT, HOST);
console.log(`Running on http://${HOST}:${PORT}`);
