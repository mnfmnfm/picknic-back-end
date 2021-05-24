const express = require('express');
const cors = require('cors');
const { default: axios } = require('axios');
const mongoose = require('mongoose');
require('dotenv').config();
const Users = require('./models/Users.js');

const app = express();
const PORT = process.env.PORT || 5001;

mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function () {
  console.log('mongodb is connected!');
});

app.use(express.json());
app.use(cors());
app.get('/', (req, res) => {
  res.send('Welcome to PICKNIC back end!');
});

// I wish this code were more modularized, not all in one file.
// business profile GET
app.get('/business/profile', (req, res) => {
  Users.find({ email: req.query.email }, (error, data) => {
    if (error) {
      res.send(error);
    } else {
      if (data.length === 0) {
        res.send(data);
      } else {
        res.send(data[0].businesses);
      }
    }
  });
});

// The fact that the handlers for /yelp and /businesses/search are so similar makes me want to combine them...
function getBusinessesAndRespond(location, term, res) {
  axios({
    method: 'get',
    url: `${process.env.YELP_BUSINESS_ENDPOINT}/search?location=${location}&term=${term}`,
    headers: {
      Authorization: `Bearer ${process.env.YELP_API_KEY}`,
      'content-type': 'application/json'
    }
  }).then(response => res.json(response.data.businesses))
    .catch(error => console.log(error))
}

app.get('/yelp', (req, res) => {
  // for landing page, use location=seattle
  getBusinessesAndRespond('seattle', '', res);
})

// handle search by location and keyword
app.get('/businesses/search', (req, res) => {
  const location = req.query.location;
  const term = req.query.term;
  getBusinessesAndRespond(location, term, res);
})

app.get('/business/:id', (req, res) => {
  const id = req.params.id;
  axios({
    method: 'get',
    url: `${process.env.YELP_BUSINESS_ENDPOINT}/${id}`,
    headers: {
      Authorization: `Bearer ${process.env.YELP_API_KEY}`,
      'content-type': 'application/json'
    }
  }).then(response => {
    res.json(response.data)
  })
    .catch(error => console.log(error))
})

// post route to add business to specific user
app.post('/business/save', (req, res) => {
  const user = req.body;
  Users.find({ email: user.email }, (err, userData) => {
    if (err) {
      res.send(err);
    } else if (userData.length < 1) {
      // if the user not found, then save the whole data
      const newUser = new Users({
        email: user.email,
        businesses: [user.business]
      });
      newUser.save()
        .then(newUserData => {
          res.json(newUserData);
        })
        .catch(err => {
          res.status(500).send(err);
        });
    } else {
      // if the user found, then only push the business in the businesses property
      const userInfo = userData[0];
      userInfo.businesses.push(user.business);
      userInfo.save()
        .then(userInfo => {
          res.json(userInfo);
        })
        .catch(err => {
          res.status(500).send(err);
        });
    }
  })
})

// delete the business from a specific user
app.delete('/business/:id', (req, res) => {
  Users.find({ email: req.query.email }, (err, data) => {
    // error handling
    if (err) {
      res.send(err);
    } else {
      if (data.length === 0) {
        // user not found
        // nice error handling, and nice commenting
        res.status(400).send(data)
      } else {
        // user found
        const user = data[0];
        // delete the requested business with the id
        user.businesses = user.businesses.filter(business => business.id !== req.params.id);
        // save the user
        user.save()
          .then(data => {
            res.json(data.businesses);
          })
          .catch(err => res.status(500).send(err));
      }
    }
  })
});

app.listen(PORT, () => console.log(`Server is listening on port ${PORT}!`));
