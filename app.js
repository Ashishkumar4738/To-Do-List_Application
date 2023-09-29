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
const url = "mongodb+srv://admin-ashish:"+`process.env.PASS`+"@cluster0.nyms3nr.mongodb.net/todoDbTest";

var renderListName = "Home";

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
    const difList = new mongoose.Schema({	
        titname:String,	
        list:[listSchema]	
    });	
    //difList model	
    const DifList = new mongoose.model("DifList",difList);



    const loginSchema = new mongoose.Schema({
        username: String,
        password: String,
        googleId: String,
        title: [difList]
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

    const item = new DifList({
        titname:"Home",
        list:[item1,item2,item3]
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
        callbackURL: "https://fantastic-jade-buffalo.cyclic.cloud/auth/google/home",
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
            res.redirect("/home");
            }else{
                res.render("login.ejs");
            }
    });

    app.get("/register", (req, res) => {
        res.render("register.ejs");
    });

    app.get("/home", async (req, res) => {

        if (req.isAuthenticated()) {
            let data = await Login.findOne({ username: req.user.username });
            //console.log(data.title[0].titname);
            let list = data.title.filter(element => element.titname===renderListName);
            //console.log(list[0].list);
            if (data.title.length === 0) {
                await Login.findOneAndUpdate({ username: req.user.username }, { title: [item]});
                res.redirect("/");
            }
             data = await Login.findOne({ username: req.user.username });
            list = data.title.filter(element => element.titname===renderListName);
            //console.log(list)
                res.render("home.ejs", {
                listname:data.title,
                title:list[0].titname,
                username: data.username,
                date: date,
                day: day,
                arr: list[0].list
            });
        } else {
            res.redirect("/");
        }
    });

    app.get("/renderlist:listName",(req,res)=>{
        renderListName = req.params.listName.substring(1) ;
        // console.log(value);
        // console.log(req.body.renderlist);
        res.redirect("/home");
    })

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
                        await Login.updateOne({ username: username }, { title: [item] });
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
        console.log(req.body.deleteItem);
        await Login.findOneAndUpdate({ username: req.user.username,"title.list._id":id },{$pull:{"title.$.list":{_id:id}}});  
        res.redirect("/home");
    });

    app.post("/addNew", async (req, res) => {
        const data = await Login.findOne({ username: req.user.username });
        console.log(data.title);
         const findlistArr = data.title.filter(element=>(element.titname===renderListName))
        const item = new Item({
            name: req.body.newItem
        })
         await findlistArr[0].list.push(item);
         await data.save();
        res.redirect("/home");
    });
        
    app.post("/create_new_List", async(req,res)=>{
        const listName = req.body.newListName;
        const newList = new DifList({
            titname:listName,
            list:[item1,item2,item3]
        });
        const user = req.user._id;
        const data = await Login.findById({_id:user}).exec();
        //console.log(data);
        data.title.push(newList);
        await data.save();
        res.redirect("/home");
    })






    app.set('port', (process.env.PORT || 3000));
    app.listen(app.get(`port`) || port, (req, res) => {
        console.log("servers started at port "+app.get(`port`));
    });
};
