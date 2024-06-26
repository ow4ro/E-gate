const express = require("express")
const app = express()

const path = require("path")
const methodOverride = require("method-override")

const mongoose = require("mongoose")
const Resident = require('./models/residents');
const Visitor = require('./models/visitor');

const passport = require('passport');
const initializePassport = require('./passport-config');
const session = require('express-session');
const bcrypt = require('bcrypt');

const nodemailer = require('nodemailer');
const crypto = require('crypto'); // Built-in Node.js module for generating random bytes

app.use(session({
    secret: 'abcdef',
    resave: false,
    saveUninitialized: true
}));

initializePassport(passport);

app.use(passport.initialize());
app.use(passport.session());

// Create a Nodemailer transporter
const transporter = nodemailer.createTransport({
    service: 'gmail', // or any other email service
    auth: {
        user: 'mineman270@gmail.com',
        pass: 'Absent_Minded_Genius'
    }
});

mongoose.connect('mongodb://127.0.0.1:27017/test')
    .then(() => {
        console.log("Connection Successful")
    })
    .catch(err => {
        console.log("Connection Failed")
        console.log(err)
    })


app.set("view engine", "ejs")
app.set("views", path.join(__dirname, "/views"))

app.use(express.urlencoded({extended: true}))
app.use(methodOverride('_method'))
app.use(express.json())

app.get("/resident_sign_up", (req, res) => {
    res.render("resident_sign_up")
})

app.post("/resident_sign_up", async (req, res) => {
    const { email, password, name, pnumber, identification_code } = req.body;

    try {
        // Check if the email already exists
        const existingResident = await Resident.findOne({ email_id: email });
        if (existingResident) {
            return res.status(400).send('Email already exists');
        }

        // Generate a random 6-digit OTP
        const otp = crypto.randomBytes(3).toString('hex');

        // Send the OTP via email
        const mailOptions = {
            from: 'mineman270@gmail.com',
            to: email,
            subject: 'Email Verification OTP',
            text: `Your OTP for email verification is: ${otp}`
        };

        // Use await here
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent: ' + info.response);

        // Render a view or display a prompt for the user to enter the OTP
        res.render('enterOTP', { email, otp });
    } catch (error) {
        console.error("Error adding Resident:", error.message);
        res.redirect("/");
    }
});

app.post('/verifyOTP', async (req, res) => {
    const { email, otp, password, name, pnumber, identification_code } = req.body;

    try {
        // Check if the OTP is valid
        const resident = await Resident.findOne({ email_id: email, otp });
        if (!resident) {
            return res.status(400).send('Invalid OTP');
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create a new Resident instance with form data
        const newResident = new Resident({
            name,
            password: hashedPassword,
            phone_number: pnumber,
            email_id: email,
            identification_code: identification_code
        });

        // Save the newResident to the database
        const savedResident = await newResident.save();
        console.log("New Resident added:", savedResident);

        // Clear the OTP from the database
        resident.otp = undefined;
        await resident.save();

        // Redirect to the login page or wherever you want
        res.redirect("/login");
    } catch (error) {
        console.error("Error adding Resident:", error.message);
        res.redirect("/");
    }
});

app.get("/visitor_sign_up", (req, res) => {
    res.render("visitor_sign_up")
})

app.post("/visitor_sign_up", async (req, res) => {
    const { name, phone_number, vehicle_number, entryDate, tenure_hours } = req.body;

    try {
        // Create a new Resident instance with form data
        const newVisitor = new Visitor({
            name: name,
            phone_number: phone_number,
            vehicle_number: vehicle_number,
            entry: entryDate,
            tenure_hours: tenure_hours
        });

        // Save the newResident to the database
        const savedVisitor = await newVisitor.save();

        console.log("New Visitor added:", savedVisitor);

        // Redirect to the home page or wherever you want
        res.redirect("/home");
    } catch (error) {
        // If there is an error, handle it
        console.error("Error adding Visitor:", error.message);
        // Redirect to an error page or handle the error in another way
        res.redirect("/");
    }
});

app.get('/login', (req, res) => {
    res.render('login');
});

app.post('/login', passport.authenticate('local', {
    successRedirect: '/dashboard',
    failureRedirect: '/',
    failureFlash: true
}));

app.post('/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) {
            return next(err);
        }
        res.redirect('/login');
    });
});

const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login');
};

app.get('/dashboard', ensureAuthenticated, (req, res) => {
    res.render('dashboard', { resident: req.user });
});

app.get("/", (req, res) => {
    res.render("home")
})

app.use((req, res) => {
    console.log("Got a request!")
    res.send("This is a response")
})

app.listen(5000, () => {
    console.log("Listening on port 5000")
})