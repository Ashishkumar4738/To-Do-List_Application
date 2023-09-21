require("dotenv").config();
const express = require("express");
const bodyparser = require("body-parser");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const findOrCreate = require("mongoose-findorcreate");

const app = express();
const url = "mongodb://127.0.0.1:27017/todoDb";


app.use(bodyparser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(session({
    secret: "thisissecret",
    resave: false,
    saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());



//find date for showcase
const date = new Date().toJSON().slice(0, 10).replace(/-/g, '/');
const weekday = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const d = new Date();
const day = weekday[d.getDay()];

var display = "";
//connect to db
main().catch(err => console.log(err));
async function main() {
    await mongoose.connect(url);
    //listSchema
    const listSchema = new mongoose.Schema({
        name: String
    });

    //model for listSchema
    const Item = new mongoose.model("List", listSchema);
    //loginSchema
    const loginSchema = new mongoose.Schema({
        username: String,
        password: String,
        googleId: String,
        title: [listSchema]
    });

    loginSchema.plugin(passportLocalMongoose);
    loginSchema.plugin(findOrCreate);
    //model form loginSchema
    const Login = new mongoose.model("login", loginSchema);
    const item1 = new Item({
        name: "Welcome to your to do list"
    });
    const item2 = new Item({
        name: "Hit the + button to add new item"
    });
    const item3 = new Item({
        name: "<-- Hit this delete an item"
    });

    passport.use(Login.createStrategy());
    // passport.serializeUser(Login.serializeUser());
    // passport.deserializeUser(Login.deserializeUser());
    passport.serializeUser(function (user, done) {
        done(null, user);
    });

    passport.deserializeUser(function (user, done) {
        done(null, user);
    });

    passport.use(new GoogleStrategy({
        clientID: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        callbackURL: "http://localhost:3000/auth/google/home",
        userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
    },
        function (accessToken, refreshToken, profile, cb) {
            display = profile.displayName;
            //console.log(profile.displayName);
            Login.findOrCreate({ googleId: profile.id }, { username: profile.displayName }, function (err, user) {
                return cb(err, user);
            });
        }
    ));
    app.get('/auth/google',
        passport.authenticate('google', { scope: ['profile'] }));

    app.get('/auth/google/home',
        passport.authenticate('google', { failureRedirect: '/' }),
        function (req, res) {
            // Successful authentication, redirect home.
            console.log("in auth google home");
            res.redirect("/home");
        });

    app.get("/", async (req, res) => {

        if (req.isAuthenticated()) {
            const data = await Login.findOne({ username: req.user.username });
            // data.title.forEach(element => {
            //     console.log(element.name);
            // });
            if(data.title.length!==0){
                 res.render("home.ejs", {
                username: data.username,
                date: date,
                day: day,
                arr: data.title
            });
            }else{
                res.render("login.ejs");
            }
           
        } else {
            res.render("login.ejs");
        }
    });

    app.get("/register", (req, res) => {
        res.render("register.ejs");
    });

    app.get("/home", async (req, res) => {

        if (req.isAuthenticated()) {
            const data = await Login.findOne({ username: req.user.username });
            if (data.title.length === 0) {
                await Login.findOneAndUpdate({ username: req.user.username }, { title: [item1, item2, item3] });
                res.redirect("/home");
            }
            // data.title.forEach(element => {
            //     console.log(element.name);
            // });

            res.render("home.ejs", {
                username: data.username,
                date: date,
                day: day,
                arr: data.title
            });
        } else {
            res.redirect("/");
        }
    });

    app.get("/logout",(req,res)=>{
        req.logout(function(err) {
            if (err) { return next(err); }
            res.redirect('/');
          });
    });

    app.post("/login", async (req, res) => {
        const username = req.body.username;
        const password = req.body.password;
        const user = new Login({
            username: req.body.username,
            password: req.body.password
        });
        const finduser = await Login.findOne({ username: username });
        if (!finduser) res.redirect("/register");
        req.login(user, function (err) {
            if (err) {
                console.log(err);
            } else {
                passport.authenticate("local")(req, res, async function () {
                    const data = await Login.findOne({ username: username });
                    if (data.title.length === 0) {
                        await Login.updateOne({ username: username }, { title: [item1, item2, item3] });
                        await data.save();
                    }
                    //console.log(data.title);
                    res.redirect("/home");
                })
            }
        })
    });

    app.post("/register", (req, res) => {
        const username = req.body.username;
        const password = req.body.password;
        Login.register({ username }, password, function (err, user) {
            if (err) {
                console.log(err);
            }
            else {
                passport.authenticate("local")(req, res, async function () {
                    //console.log(user);
                    const data = await Login.findOne({ username: username });
                    if (data.title.length === 0) {
                        await Login.updateOne({ username: username }, { title: [item1, item2, item3] });
                        await data.save();
                    }
                    const data2 = await Login.findOne({ username: username });
                    console.log(data2.title);
                    res.redirect("/home");
                });
            }
        });
        //res.render("home.ejs");
    });

    app.post("/delete", async (req, res) => {
        const id = req.body.deleteItem;
        //console.log(req.body.deleteItem);
        await Login.findOneAndUpdate({ username: req.user.username }, { $pull: { title: { _id: id } } })
        res.redirect("/home");
    });

    app.post("/addNew", async (req, res) => {
        const data = await Login.findOne({ username: req.user.username });
        //console.log(req.body.newItem);
        const item = new Item({
            name: req.body.newItem
        })
        await data.title.push(item);
        await data.save();
        res.redirect("/home");
    })






    app.set('port', (process.env.PORT || 3000));
    app.listen(app.get(`port`) || port, (req, res) => {
        console.log("servers started at port "+app.get(`port`));
    });
};