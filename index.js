import e from "express";
import fs from "fs";
import http, { createServer } from "http";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import ejs from "ejs";
import mongoose from "mongoose";
import mongo from "mongodb";
import nodemailer from "nodemailer";
import LocalUser from "./Models/localuser.js";
import session from "express-session";
import Otps from "./Models/otpverifications.js";
import bodyParser from "body-parser";
import MongoStore from "connect-mongo";
import Donor from "./Models/donorModel.js";
import admin from "firebase-admin";
// import serviceAccount from "./Models/real-time-blood-donation-c0c32-firebase-adminsdk-2q376-f788502794.json" assert { type: "json" };
import { assert, info } from "console";
import TokenUser from "./Models/tokenUser.js";
import RequestsForDonor from "./Models/requestsForDonors.js";
import twilio from "twilio";
import sentRequest from "./Models/sentRequests.js";
import bcrypt from "bcrypt";
import AcceptedRequests from "./Models/acceptedRequests.js";
import { Vonage } from "@vonage/server-sdk";
import { type } from "os";
import https from "https";
import cors from "cors";

const accountSid = "AC3ec82eb9b05651f92c1a8b69346e1ae9";
const authToken = "2c04ee1ad1843d61a2fb7aaf45a1372d";
const client = twilio(accountSid, authToken);

const app = e();
const PORT = process.env.PORT || 5000;
const url =
  process.env.BASE_URL ||
  "https://real-time-blood-donation-production.up.railway.app";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: "coderangersverify@gmail.com",
    pass: "vzhykowzuabnjscw ",
  },
});

const vonage = new Vonage({
  apiKey: "960bb5c8",
  apiSecret: "mED9PsA8nSqxlzY2",
});

const vonageUser = "960bb5c8";
const vonagePass = "mED9PsA8nSqxlzY2";
const from = "14157386102";

function sendVonageMessage(to, body) {
  const data = JSON.stringify({
    from: { type: "whatsapp", number: from },
    to: { type: "whatsapp", number: to },
    message: {
      content: {
        type: "text",
        text: body,
      },
    },
  });

  const options = {
    hostname: "messages-sandbox.nexmo.com",
    port: 443,
    path: "/v0.1/messages",
    method: "POST",
    authorization: {
      username: vonageUser,
      password: vonagePass,
    },
    headers: {
      Authorization: "Basic " + btoa(vonageUser + ":" + vonagePass),
      "Content-Type": "application/json",
    },
  };

  const req = https.request(options, (res) => {
    console.log(`statusCode: ${res.statusCode}`);

    res.on("data", (d) => {
      process.stdout.write(d);
    });
  });

  req.on("error", (error) => {
    console.error(error);
  });

  req.write(data);
  req.end();
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
app.set("view engine", "ejs");

app.set("views", path.join(__dirname, "views"));

const serviceAccountPath = path.join(
  __dirname,
  "./Models/real-time-blood-donation-c0c32-firebase-adminsdk-2q376-f788502794.json"
);

// Read the JSON file synchronously
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf-8"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// app.use(
//   session({
//     secret: process.env.SESSION_SECRET || "secret",
//     resave: false,
//     saveUninitialized: false,
//     cookie: {
//       secure: process.env.NODE_ENV === "production",
//       httpOnly: true,
//       maxAge: 24 * 60 * 60 * 1000,
//     },
//   })
// );

app.use(
  session({
    secret: process.env.SESSION_SECRET || "secret",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl:
        "mongodb+srv://myAtlasDBUser:Hero123456@test1.bu7v6.mongodb.net/bloodDonation?retryWrites=true&w=majority&appName=Test1",
      collectionName: "sessions",
    }),
    cookie: {
      maxAge: 1000 * 60 * 60 * 24,
      sameSite: "lax",
      secure: false,
    },
  })
);

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
// app.use(e.static("public"));
app.use(e.static(__dirname + "/public/"));
app.use(e.json());
app.use(e.urlencoded({ extended: true }));

// service: "smtp.gmail.com",
//   auth: {
//     user: "coderangersverify@gmail.com",
//     pass: "vzhykowzuabnjscw ",
//   }

// req.session.email = "testing";

function sendNotification(userToken, title, body) {
  console.log(userToken);
  const message = {
    token: userToken,
    notification: {
      title,
      body,
      // icon: "https://png.pngtree.com/png-clipart/20230426/original/pngtree-blood-drop-blood-red-cartoon-illustration-png-image_9103018.png",
    },
    data: {
      click_action: `${url}/dashboard`,
    },
  };
  admin
    .messaging()
    .send(message)
    .then((response) => {
      console.log("Notification sent successfully", response);
    })
    .catch((error) => {
      console.log("Error sending notification", error);
    });
}

function sendWhatsappMessage(to, body) {
  client.messages
    .create({
      from: "whatsapp:+14155238886",
      body: "Hi you have a request",
      to: `whatsapp:${to}`,
    })
    .then((message) => console.log(message.sid));
}

app.get("/favicon.ico", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "favicon.ico"));
});

app.get("/", async (req, res) => {
  // console.log(req.session.email);
  // console.log(req.session.name);
  // console.log(req.session.username);
  const foundUser = await Donor.findOne({ email: req.session.email }).lean();
  // console.log(foundUser);
  if (foundUser) {
    res.render("welcome", { userLoggedIn: true, active: true });
  } else if (req.session.email) {
    res.render("welcome", { userLoggedIn: true, active: false });
  } else {
    res.render("welcome", { userLoggedIn: false, active: false });
  }
});

app.get("/profile", async (req, res) => {
  if (req.session.email) {
    const currentUser = await LocalUser.findOne({ email: req.session.email });
    let username = currentUser.username;
    let email = currentUser.email;
    let name = currentUser.name;
    let mobile = currentUser.mobile;
    let bloodgroup = currentUser.bloodgroup;
    res.render("profile", {
      userLoggedIn: true,
      username,
      email,
      name,
      mobile,
      bloodgroup,
    });
  } else {
    res.redirect("/signin");
  }
});

app.get("/signup", (req, res) => {
  res.render("signup");
});

app.get("/signin", (req, res) => {
  res.render("signin");
});

app.post("/nearbysearch", async (req, res) => {
  const { nearbyHospitals, bdGroup } = req.body;
  let currUsername = req.session.username;
  let donorexist = [];
  let currHospital;
  let hospital1;
  let selectedHospitals = [];
  if (bdGroup === "ANY") {
    for (const hospital of nearbyHospitals) {
      donorexist = await Donor.find({
        hospitals: {
          $elemMatch: { placeId: hospital.place_id },
        },
        username: { $ne: currUsername },
      });
      if (donorexist.length > 0) {
        // for (let i = 0; i < donorexist.length; i++) {
        //   // if(donorexist[i].email === req.session.email) {
        //   //   continue;
        //   // }
        //   let loc = `${donorexist[i].location.sublocality}, ${donorexist[i].location.town}`;
        //   let hospital1 = {
        //     name: hospital.name,
        //     // donorName: donorexist[i].name,
        //     // donorUserName: donorexist[i].username,
        //     distance: hospital.distance,
        //     bloodGroup: donorexist[i].bloodGroup,
        //     count: donorexist.length,
        //   };
        //   selectedHospitals.add(hospital1);
        // }

        hospital1 = {
          hospitalName: hospital.name,
          hospitalPlaceId: hospital.place_id,
          bdGroup: bdGroup,
          distance: Math.round(hospital.distance) / 1000,
          count: donorexist.length,
        };

        selectedHospitals.push(hospital1);
      }
    }
  } else {
    for (const hospital of nearbyHospitals) {
      donorexist = await Donor.find({
        hospitals: {
          $elemMatch: { placeId: hospital.place_id },
        },
        bloodGroup: bdGroup,
        username: { $ne: currUsername },
      });
      if (donorexist.length > 0) {
        //   for (let i = 0; i < donorexist.length; i++) {
        //     // if(donorexist[i].email === req.session.email) {
        //     //   continue;
        //     // }
        //     let loc = `${donorexist[i].location.sublocality}, ${donorexist[i].location.town}`;
        //     let hospital1 = {
        //       name: hospital.name,
        //       donorName: donorexist[i].name,
        //       donorUserName: donorexist[i].username,
        //       donorPlace: loc,
        //       bloodGroup: donorexist[i].bloodGroup,
        //     };
        //     selectedHospitals.push(hospital1);
        //   }
        // }
        hospital1 = {
          hospitalName: hospital.name,
          hospitalPlaceId: hospital.place_id,
          bdGroup: bdGroup,
          distance: Math.round(hospital.distance) / 1000,
          count: donorexist.length,
        };
        selectedHospitals.push(hospital1);
      }
    }

    // if (donorexist.length > 0) {
    //   for (let i = 0; i < donorexist.length; i++) {
    //     // if(donorexist[i].email === req.session.email) {
    //     //   continue;
    //     // }
    //     let loc = `${donorexist[i].location.sublocality}, ${donorexist[i].location.town}`;
    //     let hospital1 = {
    //       name: hospital.name,
    //       donorName: donorexist[i].name,
    //       donorUserName: donorexist[i].username,
    //       donorPlace: loc,
    //       bloodGroup: bdGroup,
    //     };
    //     selectedHospitals.push(hospital1);
    //   }
    // }
  }
  res.status(200).json({ selectedHospitals });
});

app.get("/requestblood", (req, res) => {
  if (req.session.email) {
    res.render("request", { userLoggedIn: true });
  } else {
    res.redirect("/signin");
  }
});

app.get("/donateblood", async (req, res) => {
  const currentUser = await Donor.findOne({ email: req.session.email });
  console.log(currentUser);
  if (currentUser) {
    res.render("donate", { userLoggedIn: true, active: true });
  } else if (req.session.email) {
    res.render("donate", { userLoggedIn: true, active: false });
  } else {
    res.redirect("/signin");
  }
});

app.post("/donoractive", async (req, res) => {
  const { selectedHospitals, sublocality, town } = req.body;
  await Donor.deleteOne({ email: req.session.email });
  const currentUser = await LocalUser.findOne({ email: req.session.email });
  const newDonor = await new Donor({
    name: currentUser.name,
    username: currentUser.username,
    email: currentUser.email,
    bloodGroup: currentUser.bloodgroup,
    hospitals: selectedHospitals,
    location: {
      sublocality,
      town,
    },
  });

  await newDonor.save();
  res.status(200).send("Saved");
  // 100ms delay
});

app.post("/donorinactive", async (req, res) => {
  const curr = await Donor.deleteOne({ email: req.session.email });
  res.status(200).send("Deleted");
});

app.post("/signup", async (req, res) => {
  const data = req.body;
  const { name, userName, email, password, mbNumber, bdGroup } = data;
  let saltrounds = 10;
  const hashedPassword = await bcrypt.hash(password, saltrounds);
  const verified = false;

  console.log("in");

  if (name && userName && email && password && mbNumber && bdGroup) {
    console.log("in2");
    try {
      const existingUser = await LocalUser.findOne({ email: email });
      if (existingUser) {
        return res.send("User already exists");
      }

      console.log("in3");
      const newUser = new LocalUser({
        name,
        username: userName,
        email,
        password: hashedPassword,
        mobile: mbNumber,
        bloodgroup: bdGroup,
        verified,
      });

      // req.session.email = email;
      // req.session.name = userName;

      const savedUser = await newUser.save();

      const otp = Math.floor(100000 + Math.random() * 900000);
      const mailOptions = {
        from: "coderangersverify@gmail.com",
        to: email,
        subject: "OTP Verification",
        text: `Your OTP is: ${otp}`,
      };

      const newOtpUser = new Otps({
        username: userName,
        email,
        emailOtp: otp,
      });

      await newOtpUser.save();
      // req.session.email = await newOtpUser.email;

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.log(error);
          return res.send("Failed to send OTP");
        } else {
          console.log("Email sent: " + info.response);
        }
      });
    } catch (error) {
      console.error("Error during signup:", error);
      res.status(500).send("Internal Server Error");
    }
  } else {
    res.send("Please fill all the fields");
  }
});

app.post("/otpVerify", async (req, res) => {
  let { hidemail, otp } = req.body;
  const email1 = hidemail;
  console.log(otp);
  console.log(email1);
  otp = parseInt(otp);

  try {
    const otpUser = await Otps.findOne({ email: email1 });
    if (!otpUser) {
      return res.status(400).send("No OTP found for this email.");
    }

    if (otpUser.emailOtp === otp) {
      const user = await LocalUser.findOne({ email: email1 });
      if (!user) {
        return res.status(400).send("User not found.");
      }

      user.verified = true;
      await user.save();
      res.redirect("/signin");
    } else {
      res.redirect("/signup");
    }
  } catch (error) {
    console.error("Error during OTP verification:", error);
    res.status(500).send("Internal Server Error");
  }
});

// app.get("/createSession", (req, res) => {
//   req.session.email = "myname";
//   res.send("Session created");
//   console.log("I created: " + req.session.email);
// });

// app.get("/checkSession", (req, res) => {
//   if (req.session.email) {
//     res.send("Session exists");
//     console.log("I have: " + req.session.email);
//   } else {
//     res.send("Session does not exist");
//   }
// });

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  // req.session.email = email;
  console.log(email);
  const currentUser = await LocalUser.findOne({ email });
  if (currentUser) {
    const checkPass = await bcrypt.compare(password, currentUser.password);
    if (checkPass) {
      req.session.email = email;
      req.session.name = await currentUser.name;
      req.session.username = await currentUser.username;
      await req.session.save();
      res.redirect("/");
    } else {
      res.send("Incorrect password");
    }
  } else {
    res.send("User not found");
  }
  console.log(req.session.email);
});

app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) throw err;
    res.redirect("/");
  });
});

app.post("/fetchUserData", async (req, res) => {
  const { email } = req.session.email;
  const userData = await LocalUser.findOne({ email });
  if (userData) {
    res.status(200).json({ userData });
  } else {
    res.status(400).json({ status: 400 });
  }
});

app.post("/checkFCMToken", async (req, res) => {
  console.log("Request body:", req.body); // Log the request body
  console.log("Session:", req.session); // Log session data

  console.log("cc");
  const { token } = req.body;
  console.log(token);
  const username = req.session.username;
  const email = req.session.email;

  console.log(username);
  console.log(email);

  console.log("ITs fine 0");

  if (!token) {
    return res.status(400).send("Token is missing");
  }
  console.log("ITs fine 11");
  if (!username || !email) {
    return res.status(400).send("Session is missing username or email");
  }
  console.log("ITs fine 1");
  const tokenUser = await TokenUser.findOne({ tokenId: token });
  if (tokenUser) {
    res.status(200).send("Token exists");
  } else if (email && username) {
    console.log("ITs fine 2");

    const tokenUser = new TokenUser({
      username,
      email,
      tokenId: token,
    });
    console.log("ITs fine 3");

    await tokenUser.save();
    res.status(200).send("Token saved");
  } else {
    res.status(400).send("Token not saved");
  }
});

app.post("/sendNotification", async (req, res) => {
  const { title, body, username } = req.body;
  const user = await TokenUser.find({ username });
  if (user) {
    for (let i = 0; i < user.length; i++) {
      sendNotification(user[i].tokenId, title, body);
    }
    res.status(200).send("Notification sent");
  } else {
    res.status(400).send("User not found");
  }
});

app.post("/searchDonors", async (req, res) => {
  console.log("------------------------------------------");
  const requestorUsername = req.session.username;
  const requestorEmail = req.session.email;
  const { hospitalPlaceId, bdGroup } = req.body;

  try {
    let donors = await Donor.find({
      hospitals: { $elemMatch: { placeId: hospitalPlaceId } },
    });

    donors = donors.filter((donor) => donor.username !== requestorUsername);

    if (donors.length > 0) {
      const hospitalName = donors[0].hospitals.find(
        (place) => place.placeId === hospitalPlaceId
      ).name;
      addRequestToSelfRecords(
        requestorUsername,
        requestorEmail,
        bdGroup,
        hospitalName,
        hospitalPlaceId,
        donors.length
      );

      donors.forEach(async (donor) => {
        addRequestToDonorRecords(
          donor.name,
          donor.username,
          donor.email,
          bdGroup,
          hospitalName,
          requestorUsername,
          hospitalPlaceId
        );

        const donorTokenId = await TokenUser.find({ email: donor.email });
        donorTokenId.forEach((donor) => {
          sendNotification(
            donor.tokenId,
            "Donation Request",
            "Blood donation request from a user"
          );
        });

        sendMail(
          donor.email,
          donor.name,
          "Donation Request",
          `Blood donation request from a user at a nearby hospital
          To respond, visit the website: ${url}/dashboard
          `
        );

        const Local = await LocalUser.findOne({ email: donor.email });
        const mobile = `+91${Local.mobile}`;
        console.log(mobile);
        console.log(typeof mobile);
        const message = `
              Hi ${donor.name},
      
              You have a Blood Donation request from a user at a nearby hospital. Please visit the website to respond.
              Visit the website: https://real-time-blood-donation.onrender.com/dashboard
      
              Thank you for your support.
              `;
        sendWhatsappMessage(mobile, message);
        const mobile2 = `91${Local.mobile}`;
        sendVonageMessage(mobile2, message);
      });
      res.status(200).send("Donors found");
    } else {
      res.status(500).send("No donors found");
    }
  } catch (error) {
    console.error("Error during search for donors:", error);
    res.status(500).send("Internal Server Error");
  }
});

async function addRequestToDonorRecords(
  name,
  username,
  email,
  bdGroup,
  hospitalName,
  requestorUsername,
  hospitalPlaceId
) {
  const duplicate = await RequestsForDonor.findOne({
    username,
    requestorUsername,
    hospitalPlaceId,
  });
  if (duplicate) {
    return;
  }
  const newRequest = new RequestsForDonor({
    username,
    email,
    bloodGroup: bdGroup,
    requestorUsername,
    hospitalName,
    hospitalPlaceId,
  });
  await newRequest.save();

  // notifyUser(
  //   name,
  //   username,
  //   email,
  //   bdGroup,
  //   requestorUsername,
  //   hospitalPlaceId
  // );
}

// async function notifyUser(
//   name,
//   username,
//   email,
//   bdGroup,
//   requestorUsername,
//   hospitalPlaceId
// ) {
// }

function sendMail(to, name, subject, text) {
  const mailOptions = {
    from: "coderangersverify@gmail.com",
    to: to,
    subject: subject,
    text: `Hi ${name},
    
    ${text}
    
   `,
  };
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log(error);
      return res.send("Failed to send mail");
    } else {
      console.log("Email sent: " + info.response);
    }
  });
}

app.get("/dashboard", (req, res) => {
  if (req.session.email) {
    res.render("dashboard", { userLoggedIn: true });
  } else {
    res.redirect("/signin");
  }
});

async function addRequestToSelfRecords(
  username,
  email,
  bdGroup,
  hospitalName,
  hospitalPlaceId,
  hospitalCount
) {
  const dup = await sentRequest.findOne({ username, hospitalPlaceId });
  if (dup) {
    if (dup.donorCount === hospitalCount) {
      return;
    } else {
      await sentRequest.updateOne(
        { username, hospitalPlaceId },
        { donorCount: hospitalCount }
      );
    }
  }
  const newRequest = new sentRequest({
    username,
    email,
    bloodGroup: bdGroup,
    hospitalName: hospitalName,
    donorCount: hospitalCount,
    hospitalPlaceId,
  });

  await newRequest.save();
}

// app.post("/api/donationrequests", async (req, res) => {
//   const username = req.session.username;
//   const myDonorRequests = await RequestsForDonor.find({ username });
//   const donorHospitals = await Donor.findOne({ username });
//   const sentRequests = await sentRequest.find;
//   let finalizedData = [];
//   let requiredHospitals = [];

//   const isReserved = await RequestsForDonor.findOne({ accepted: true });
//   console.log(isReserved);
//   if (isReserved) {
//     res.status(300).send("Request already accepted", isReserved);
//   } else {
//     if (myDonorRequests.length > 0) {
//       let requiredHospitalsIds = myDonorRequests.map(
//         (request) => request.hospitalPlaceId
//       );
//       myDonorRequests.forEach(async (request) => {
//         let ob1 = {
//           username: request.requestorUsername,
//           bloodGroup: request.bloodGroup,
//           hospitalPlaceId: request.hospitalPlaceId,
//           dateRequested: request.DateRequested,
//         };
//         requiredHospitals.push(ob1);
//       });

//       donorHospitals.hospitals.forEach((hospital) => {
//         requiredHospitals.forEach((request) => {
//           if (hospital.placeId === request.hospitalPlaceId) {
//             let date = new Date(request.dateRequested);
//             let ob2 = {
//               requestorUsername: request.username,
//               bloodGroup: request.bloodGroup,
//               hospitalPlaceId: request.hospitalPlaceId,
//               hospitalName: hospital.name,
//               dateRequested: date.toLocaleDateString(),
//             };
//             finalizedData.push(ob2);
//           }
//         });
//       });
//     }
//     res.status(200).send(finalizedData);
//   }
// });

app.post("/api/donationrequests", async (req, res) => {
  const username = req.session.username;
  const myDonorRequests = await RequestsForDonor.find({ username });
  const donorHospitals = await Donor.findOne({ username });
  const sentRequests = await sentRequest.find;
  let finalizedData = [];
  let requiredHospitals = [];

  const isReserved = await RequestsForDonor.findOne({
    username: username,
    accepted: true,
  });
  const acceptedData = await AcceptedRequests.findOne({
    acceptorUsername: username,
  });

  if (isReserved) {
    res.status(300).json({
      message: "Request already accepted",
      data: { isReserved, acceptedData },
    });
  } else {
    if (myDonorRequests.length > 0) {
      let requiredHospitalsIds = myDonorRequests.map(
        (request) => request.hospitalPlaceId
      );
      myDonorRequests.forEach(async (request) => {
        let ob1 = {
          username: request.requestorUsername,
          bloodGroup: request.bloodGroup,
          hospitalPlaceId: request.hospitalPlaceId,
          dateRequested: request.DateRequested,
        };
        requiredHospitals.push(ob1);
      });

      donorHospitals.hospitals.forEach((hospital) => {
        requiredHospitals.forEach((request) => {
          if (hospital.placeId === request.hospitalPlaceId) {
            let date = new Date(request.dateRequested);
            let ob2 = {
              requestorUsername: request.username,
              bloodGroup: request.bloodGroup,
              hospitalPlaceId: request.hospitalPlaceId,
              hospitalName: hospital.name,
              dateRequested: date.toLocaleDateString(),
            };
            finalizedData.push(ob2);
          }
        });
      });
    }
    res.status(200).json(finalizedData);
  }
});

app.post("/api/sentrequests", async (req, res) => {
  const username = req.session.username;
  const myRequests = await sentRequest.find({
    username,
  });
  let requiredHospitals = [];
  const donorHospitals = await Donor.findOne({ username });
  let sentHospitals = [];

  let finalizedData = [];

  if (myRequests.length > 0) {
    myRequests.forEach(async (request) => {
      let date = new Date(request.DateRequested);
      let ob1 = {
        bloodGroup: request.bloodGroup,
        hospitalName: request.hospitalName,
        hospitalPlaceId: request.hospitalPlaceId,
        donorCount: request.donorCount,
        dateRequested: date.toLocaleDateString(),
        satisfied: request.satisfied,
      };
      requiredHospitals.push(ob1);
    });

    // donorHospitals.hospitals.forEach((hospital) => {
    //   requiredHospitals.forEach((request) => {
    //     if (hospital.placeId === request.hospitalPlaceId) {
    //       let date = new Date(request.dateRequested);
    //       let ob2 = {
    //         bloodGroup: request.bloodGroup,
    //         hospitalName: hospital.name,
    //         donorCount: request.donorCount,
    //         satisfied: request.satisfied,
    //         dateRequested: date.toLocaleDateString(),
    //       };
    //       finalizedData.push(ob2);
    //     }
    //   });
    // });
    finalizedData = requiredHospitals;
  }
  res.status(200).send(finalizedData);
});

app.post("/api/acceptrequest", async (req, res) => {
  const { requestorUsername, hospitalPlaceId } = req.body;
  const username = req.session.username;
  const requestorRequests = await sentRequest.findOne({
    username: requestorUsername,
    hospitalPlaceId,
  });

  const donorRequests = await RequestsForDonor.findOne({
    username,
    requestorUsername,
    hospitalPlaceId,
  });
  const donorDetails = await LocalUser.findOne({ username: username });
  const requestorDetails = await LocalUser.findOne({
    username: requestorUsername,
  });
  const acceptedRequests = await new AcceptedRequests({
    requestorUsername,
    requestorMobile: requestorDetails.mobile,
    acceptorUsername: username,
    hospitalPlaceId,
    hospitalName: requestorRequests.hospitalName,
    acceptorMobile: donorDetails.mobile,
    acceptorBloodGroup: donorDetails.bloodgroup,
  });

  await acceptedRequests.save();
  if (donorRequests) {
    donorRequests.accepted = true;
    await donorRequests.save();
  } else {
    res.status(400).send("Request not found");
  }

  if (requestorRequests) {
    requestorRequests.satisfied = true;
    await requestorRequests.save();
    res.status(200).send("Request accepted");
  } else {
    res.status(400).send("Request not found");
  }
});

app.post("/api/declinerequest", async (req, res) => {
  const { requestorUsername, hospitalPlaceId } = req.body;
  const username = req.session.username;
  const donorRequests = await RequestsForDonor.deleteOne({
    username,
    requestorUsername,
    hospitalPlaceId,
  });

  if (donorRequests) {
    res.status(200).send("Request declined");
  } else {
    res.status(400).send("Request not found");
  }
});

app.post("/api/satisfiedrequests", async (req, res) => {
  const { data } = req.body;
  var finalizedData = [];
  for (const request of data) {
    const username = req.session.username;
    const hospitalPlaceId = request.hospitalPlaceId;
    const hospitalName = request.hospitalName;

    const acceptorDetails = await AcceptedRequests.findOne({
      requestorUsername: username,
      hospitalPlaceId,
    });

    if (acceptorDetails !== null) {
      finalizedData.push(acceptorDetails);
    }
  }
  if (finalizedData.length > 0) {
    res.status(200).send(finalizedData);
  } else {
    res.status(300).send("No satisfied requests found");
  }
});

app.post("/api/cancelrequests", async (req, res) => {
  const { requestPlaceId } = req.body;
  const username = req.session.username;

  const donorRequests = await RequestsForDonor.deleteMany({
    requestorUsername: username,
    hospitalPlaceId: requestPlaceId,
  });
  console.log(donorRequests);
  const sentRequests = await sentRequest.deleteOne({
    username,
    hospitalPlaceId: requestPlaceId,
  });
  console.log(donorRequests);
  if (donorRequests && sentRequests) {
    res.status(200).send("Requests cancelled");
  } else {
    res.status(400).send("Requests not found");
  }
});

app.post("/getUsername", async (req, res) => {
  const { email } = req.body;
  console.log("MEEEEEE");
  console.log(email);
  const user = await LocalUser.findOne({ email: email });
  console.log(user);
  if (user) {
    res.status(200).json({ username: user.username });
  } else {
    res.status(400).send("User not found");
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
