
/* Libraries */
const mongoose = require('mongoose'); // Object Data Modelling for Mongo
const express = require('express'); // Express Web Service
const bodyParser = require('body-parser'); //Used to parse the server response from json to object.
const os = require('os'); // Get node hostname
const axios = require('axios'); // Axios for Building Conatiners
var amqp = require('amqplib/callback_api'); //Required for messege queueing for RabbitMQ
/* Libraries End */

var nodeIsLeader = false; // Used to Set Single Node as Leader
var rabbitMQStarted = false; // Allows list nodeList to populate otherwise every node spits out its leader.
var nodeHostName = os.hostname();
var alive = true; // Node Alive or Not
var nodeID = Math.floor(Math.random() * (100 - 1 + 1) + 1);
var seconds = new Date().getTime() / 1000; // Used to establish last time node broadcasted a message.
var hasScaledUp = false; // Are we within NotFLIX Peak hours?

// Create list of nodes and message to be sent during timed interval.
var nodeMessage = { nodeID: nodeID, hostname: nodeHostName, lastMessage: seconds, alive: alive };
var nodeList = [];
nodeList.push(nodeMessage);

// Connection String Listening to Mongo Servers
const connectionString = 'mongodb://localmongo1:27017,localmongo2:27017,localmongo3:27017/notFlixDB?replicaSet=rs0';

//instance of express and port to use for inbound connections.
const app = express();
const port = 3000;


// Node Broadcasts it is alive every five seconds.
setInterval(function () {
  amqp.connect('amqp://user:bitnami@6130CompAssignment_haproxy_1', function (error0, connection) {
    if (error0) {
      throw error0;
    }
    connection.createChannel(function (error1, channel) {
      if (error1) {
        throw error1;
      }
      var exchange = "node alive";
      seconds = new Date().getTime() / 1000;
      // Message object which is broadcast to the listener.
      var msg = `{"nodeID": ${nodeID}, "hostname": "${nodeHostName}", "alive":"${alive}"}`
      var jsonMsg = JSON.stringify(JSON.parse(msg));
      channel.assertExchange(exchange, 'fanout', {
        durable: false
      });
      channel.publish(exchange, '', Buffer.from(jsonMsg));
    });
    setTimeout(function () {
      connection.close();
    }, 500);
  });
}, 5000);

// Nodes Subscribe to Message
amqp.connect('amqp://user:bitnami@6130CompAssignment_haproxy_1', function (error0, connection) {
  if (error0) {
    throw error0;
  }
  connection.createChannel(function (error1, channel) {
    if (error1) {
      throw error1;
    }
    var exchange = 'node alive';
    channel.assertExchange(exchange, 'fanout', {
      durable: false
    });
    channel.assertQueue('', {
      exclusive: true
    }, function (error2, q) {
      if (error2) {
        throw error2;
      }
      console.log(" [*] Waiting for messages in %s. To exit press CTRL+C", q.queue);
      channel.bindQueue(q.queue, exchange, '');
      channel.consume(q.queue, function (msg) {
        if (msg.content) {
          rabbitMQStarted = true;
          var incomingNode = JSON.parse(msg.content.toString());
          seconds = new Date().getTime() / 1000;
          /*Check if node is in list by its hostname, if not update the list, 
          else amend node with current seconds value and any new ID that a restarted node may have acquired.
          */
          if (nodeList.some(nodes => nodes.hostname === incomingNode.hostname)) {
            var matchedNode = nodeList.find(e => e.hostname === incomingNode.hostname);
            matchedNode.lastMessage = seconds;
            if (matchedNode.nodeID !== incomingNode.nodeID) {
              matchedNode.nodeID = incomingNode.nodeID;
            }
          } else {
            nodeList.push(incomingNode);
          }
          console.log("List of Alive Nodes");
          console.log(nodeList);
        }
      }, {
        noAck: true
      });
    });
  });
});

// Find leader based on ID and broadcast it every two seconds.
setInterval(function () {
  if (rabbitMQStarted) {
    var maxNodeID = 0; // To store current highest nodeID during the iteration.
    Object.entries(nodeList).forEach(([index, node]) => {
      if (node.hostname != nodeHostName) {
        if (node.nodeID > maxNodeID) {
          maxNodeID = node.nodeID;
        }
      }
    });
    if (nodeID >= maxNodeID) {
      console.log("The leader is: " + nodeHostName);
      nodeIsLeader = true;
    }
  }
}, 2000);

// Node hasn't sent message in ten seconds create a new instance of App.js
setInterval(function () {
  var deadNodes = []; // Temporary list storing dead nodes.
  Object.entries(nodeList).forEach(([index, node]) => {
    var timeBetweenMessage = Math.round(seconds - node.lastMessage);
    if (timeBetweenMessage > 10) {
      node.alive = false;
      deadNodes.push(node)
      nodeList.splice(index, 1); // Remove node from list of alive nodes as it is no longer needed.
      console.log("Node no longer alive: " + node.hostname);
    }
    else {
      node.alive = true;
      console.log("I am alive: " + node.hostname);
    }
  });
  if (nodeIsLeader) {
    // Create new container for every dead node that has occured.
    var randomAppNode = Math.floor(Math.random() * (999 - 100 + 1) + 100); // Give new node random 3 digit name for its hostname
    deadNodes.forEach(function (node, index) {
      var hostname = "AppNode" + (randomAppNode);
      var containerDetails = {
        Image: "6130compassignment_node1",
        Hostname: hostname,
        NetworkingConfig: {
          EndpointsConfig: {
            "6130compassignment_nodejs": {},
          },
        }
      };
      createAndStartContainer(hostname, containerDetails);
    });
  }
}, 20000);


async function createAndStartContainer(containerName, containerDetails) {
  try {
    console.log(`Attempting to start container: ${containerName}`);
    await axios.post(`http://host.docker.internal:2375/containers/create?name=${containerName}`, containerDetails).then(function (response) { console.log(response) });
    await axios.post(`http://host.docker.internal:2375/containers/${containerName}/start`);
  } catch (error) {
    console.log(error);
  }
}

async function killAndRemoveContainer(containerName) {
  try {
    console.log(`Attempting to kill container: ${containerName}`);
    await axios.post(`http://host.docker.internal:2375/containers/${containerName}/kill`);
    await axios.delete(`http://host.docker.internal:2375/containers/${containerName}`);
  } catch (error) {
    console.log(error);
  }
}

// If node within NotFLIX peak hours, spin up new two new instances to acommodate.
setInterval(function () {
  if (nodeIsLeader) {
    var nowHour = new Date().getHours();
    var randomAppNode1 = Math.floor(Math.random() * (999 - 100 + 1) + 100); // Give new node random 3 digit name for its hostname
    var randomAppNode2 = Math.floor(Math.random() * (999 - 100 + 1) + 100);
    if (nowHour >= 15 && nowHour < 17 && !hasScaledUp) { // Hours are 1 behind due to Daylight Saving Time
      console.log("NotFLIX peak hours reached, spinning up two new containers");
      var containerDetails = [{
        Image: "6130compassignment_node1",
        Hostname: "app" + randomAppNode1,
        NetworkingConfig: {
          EndpointsConfig: {
            "6130compassignment_nodejs": {},
          },
        },

      }, {
        Image: "6130compassignment_node1",
        Hostname: "app" + randomAppNode2,
        NetworkingConfig: {
          EndpointsConfig: {
            "6130compassignment_nodejs": {},
          },
        },
      }];
      console.log("Node has died, starting new node");
      containerDetails.forEach(function (node, index) {
        var nodeName = "AppNode" + node.Hostname.substring(3);
        createAndStartContainer(nodeName, node);
      });
      hasScaledUp = true; // Stops this from running multiple times.
    }
    if (nowHour < 15 && nowHour >= 17 && hasScaledUp) { // Gets last two nodes from list, kills and removes them stopping from being brought back up.
      const nodeToDelete1 = "AppNode" + nodeList.slice(-1)[0].hostname.substring(3);
      const nodeToDelete2 = "AppNode" + nodeList.slice(-2)[0].hostname.substring(3);
      killAndRemoveContainer(nodeToDelete1);
      killAndRemoveContainer(nodeToDelete2);
      hasScaledUp = false;
    }
  }
}, 5000);

//tell express to use the body parser. Note - This function was built into express but then moved to a seperate package.
app.use(bodyParser.json());

//connect to the cluster
mongoose.connect(connectionString, { useNewUrlParser: true, useUnifiedTopology: true });

var db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

var Schema = mongoose.Schema;

var interactionSchema = new Schema({
  _id: Number,
  accountID: Number,
  userName: String,
  titleID: Number,
  userAction: String,
  dateTime: String,
  pointOfInteraction: String,
  typeOfInteraction: String
});

var interactionModel = mongoose.model('Interaction', interactionSchema, 'interaction');

app.get('/', (req, res) => {
  interactionModel.find({}, 'accountID userName titleID userAction dateTime pointOfInteraction typeOfInteraction', (err, interaction) => {
    if (err) return handleError(err);
    res.send(JSON.stringify(interaction))
  })
})

app.post('/', (req, res) => {
  var interaction_instance = new interactionModel(req.body);
  interaction_instance.save(function (err) {
    if (err) res.send('Error');
    res.send(JSON.stringify(req.body))
  });
})

app.put('/', (req, res) => {
  res.send('Got a PUT request at /')
})

app.delete('/', (req, res) => {
  res.send('Got a DELETE request at /')
})

//bind the express web service to the port specified
app.listen(port, () => {
  console.log(`Express Application listening at port ` + port)
})
