# 6130CompAssignment
Repository for NotFLIX Ltd. Scalable web application.

# Installation of Docker and Windows Terminal 
To run the solution you must first install Docker for desktop and windows-terminal. Links can be found below.
- https://docs.docker.com/desktop/windows/install/ (There is a comprehensive guide to installing this which is simple to follow)
- https://www.microsoft.com/en-us/p/windows-terminal/9n0dx20hk701?activetab=pivot:overviewtab 

# VS Code Extensions
The two VS Code extensions which work with this solution are the 'REST Client' by Huachao Mao and 'MongoDB for VS Code' by MongoDB.
- These can both be installed from the market place in VS Code.

# Enable WSL Integration
To allow the Axios library to spin up containers using Docker you must enable WSL integration. To do this you must:
1) Open Docker Desktop and click the settings icon at the top.
2) Click the resources tab and click "WSL Integration" from the drop down list.
3) Tick the checkbox for enabling integration with my default WSL distro and make sure enable integration with additional distros is ticked for Ubuntu.
4) Click apply and restart.

# Running the solution
1) Open Windows Terminal and open a new tab in Ubuntu
2) Create a directory where you wish to clone the repository (mkdir "directoryname");
3) Navigate into the directory (cd "directoryname") and then run the command ("git clone https://www.github.com/Aecooolh1998/6130CompAssignment") this will clone my repository
inside of the directory which has been created. 
4) Navigate into the directory and run the command "sudo docker-compose up" this will spin up the containers and run three instances of my solution running the app.js file.
5) You should now see the application building and begin to run once the set up containers are finished running and RabbitMQ has started.
7) You can verify this by opening Docker Desktop and clicking on the "Containers / Apps" tab, which will show the running solution which can be expanded to view the running containers.


###### Tests ######

# MongoDB Tests
1) Open up MongoDB and connect to it using this connection string 'mongodb://localmongo1:27017,localmongo2:27017,localmongo3:27017/notFlixDB?replicaSet=rs0' (You may have an issue here where it cannot connect to MongoDB this can be fixed by adding '127.0.0.1 localmongo1' to your hosts file in 'C:\Windows\System32\drivers\etc')
2) Once Connected you can create a playground in order to select the notFLIXDB database and insert data, an example playground is found in mongo-tests/playground.mongodb
3) Next if you open up the mongo-tests/express.http file you will see two HTTP requests which can be sent the REST Client will allow you to 'Send Request'.
4) Clicking 'Send Request' on the GET endpoint will return all the data in the database.
5) Clicking 'Send Request' on the POST endpoing will add a new record to the database. If the post fails, it is because the set up ID number already exists, so giving it a number that is not already returned from the GET will fix this. 
5) Everytime you perform one of these actions you will see the request happen in the terminal too.

# Communication between Nodes
1) When the nodes start you will see "Waiting for messages in %s. To exit press CTRL+C" logged to the console.
2) Each node will add its self to a list of nodes, then broadcast it is alive to the other nodes.
3) Once a node recieves a message it will then broadcast to the console an array of allive nodes containing each node which is alive.
4) You can verify this in the terminal by paying attention to each nodes 'lastMessage' property as the value will consistently update each time.

# Leadership Election
1) The leading node will always log to the console if it is leader or not along with each node that is alive.
2) To verify this you can see that each node broadcasts an array of alive nodes and you can check their ID numbers against the node which is broadcasting it is the leader for verification.
3) If a node is destoryed for what ever reason and is the leader, a new node will be assigned leader.

# Handling Dead Nodes
1) The leader will check to see if a node hasn't broadcast a message in ten seconds.
2) You can manually kill a node in Docker Desktop by clicking the "Containers / Apps" tab, and expanding the project folder, here you can press the stop button on a node and it will be killed.
3) After this node doesn't send a message for ten seconds the leader will create a new node.
4) You can verify this in Docker Desktop by watching the new 'AppNode'X'' with 'X' being the number assigned to the new node.
5) If this node has a higher ID than the leader, then it will be assigned the new leader by default.

# Scale Up
1) Between the hours of 4pm and 6pm the application will build two new containers as this is NotFLIX peak time. (You can change these hours in the code for testing,
please note the set hours are an hour behind the set times as new Date().getHours() is an hour ahead)
2) You can verify this by opening Docker Desktop clicking the "Containers / Apps" tab and seeing that 'AppNode4' and 'AppNode5' have started.
3) You will also see they have been added to the list of Alive Nodes, are Broadcasting an array of all the alive nodes and the leader is stating these new nodes are alive.
4) If one of these nodes has a higher ID than the current leader, it will become the new leader automatically.

# Scale Down 
1) When the peak hours have ended then the system will automatically kill and remove these containers
2) You can verify this by opening Docker Desktop clicking the "Containers / Apps" tab and seeing that the nodes had been killed and removed.
3) You can also verify this in the terminal as the nodes will no longer be broadcasting.
4) If one of these nodes was the leader then a new node will be assigned as the leader by the system. 





###### Tests End ######