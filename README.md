# MMOEngine

MMOEngine is a framework for implementing cross-platform multiplayer in Gamemaker Studio 2.3

The framework has 3 main components:

1 - `MMOScripts.gml`: a set of GML scripts to easily connect to a server and send/recieve data.

2 - `server.js`: a NodeJS server script that hosts a game and sends data between players.

3 - `cluster.js` (OPTIONAL): a NodeJS script that connects multiple server nodes together into a cluster. This allows multiple instances of a game to be set up across different Node processes or servers. Useful if the number of players on a single server is too much for that one server.



The framework supports the TCP and WS protocols simultaneously, allowing for players on different GMS platforms to play together on the same server.

## GMS Project Usage

To use MMOEngine with an existing GMS project, add the functions inside `MMOScripts.gml` 

`scrMMOSetup()`: Initialize variables, determine networking protocol, and set up networking elements. This only needs to be run once before any connections are made.

`scrMMOConnect(ipOPTIONAL, portOPTIONAL)`: Connect to a server. If no IP and/or port is defined, the defaults set to `global.MMO_IP` and/or `global.MMO_Port` in `scrMMOSetup()` will be used instead.

`scrMMOSave()` and `scrMMOLoad()`: Save and load MMO data to the file path in `global.MMO_SavePath`. By default, this saves the unique UID, the player's name, and the player's outfit.

`scrMMOGetPacket(network_map)`: Recieves and processes all network packets. This needs to be placed in an `Async: Networking` event, with `async_load` being passed for the argument `network_map`.

`scrMMODisconnect(connectAgain)`: Disconnect from a server. If `connectAgain` is true, a new connection will be started with the server specified in `global.MMO_IP` and `global.MMO_Port`.

`scrMMOServerBrowser()`: Process a struct of all servers in a cluster. Depending on the value of `global.MMO_ServerBrowserType`, this will do different things automatically:
- 0 (default): Connect to the node with the fewest players
- 1: Connect to the node with the most players
- Anything else: Do nothing. Since this struct is saved in global.MMO_ServerBrowser, you could add new cases, like one that lets the player choose a node to connect to from a GUI.

An example struct looks like this:

```bash
{
   cap: 32, //Max capacity
   0: { //Server ID
      ip: 123.456.78.90, //IP
      p: 63456, //Port
      c: 10 //Number of players
   },
   1: {
      ip: 98.765.43.21,
      p: 63456,
      c: 20
   }
}
```

`scrMMOSendPosition(x, y, teleport)`: Send your coordinates to other players. `teleport` is an extra flag that is passed along with the coordinates and can be used for a number of client-side things. For example, coordinates where `teleport` = 1 will have your character snap to that position on other players ends. If `teleport` = 0, your character will glide to that position instead.

`scrMMOSendRoom(myRoom)`, `scrMMOSendOutfit(outfit)`, `scrMMOSendName(name)`: Send the respective property to the other players. You can add a new property with three easy steps:
1. Add that property to the `clientNet` enum of `MMOScripts.gml`, `server.js`, and `cluster.js`.
2. Copy and paste one of these functions, changing the names to your new property/enum name.
3. Add new cases for this data in the following function:

`scrMMOGetData(serverID, type, data)`, `scrMMOCreateOtherPlayer(serverID, data)`: Two functions to process another player's data and create a player from a struct of their data, respectively. These both work similarly, and you can add new data properties by adding new cases in their two `switch` statements.

There are a few more functions included, but they are all helper functions that you shouldn't need to use unless you are making substantial additions to this code. See the comments for info on how these work. 

## Server Installation

Server hosting requires a [NodeJS](https://nodejs.org/en/download/) installation and the following [npm](https://www.npmjs.com/get-npm) packages: 

```bash
npm install net
npm install http
npm install ws
npm install uuid
```
Additionally, the following packages are optional but add extra funcitonality:

Firebase data storage: `npm install firebase-admin`

Server emailing: `npm install nodemailer`

## Server.js Usage

To run the server locally, run the following command in a Terminal:

`node server.js`

TCP clients (non-HTML) can access the server on port `tcpPort` (63456 by default). WS clients use the next port up (if `tcpPort` is 63456, WS will connect to 63457) If you want players on different networks to be able to join, you must [Port Forward](https://www.noip.com/support/knowledgebase/general-port-forwarding-guide/) those two ports. 

For a more long term hosting solution, you can upload this file to a NodeJS compatible server host. [AWS Elastic Beanstalk](https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/create_deploy_nodejs.html) is a great option that has worked well for this framework, but some equally viable (and much less complicated) options include [Google Cloud](https://cloud.google.com/nodejs), [A2 Hosting](Cloud.Google.com), and [Azure](https://azure.microsoft.com/en-us/develop/nodejs/).

## Cluster.js Usage

You can run and deploy this script in the same was as `server.js`

When running a Cluster, all players should connect to the Cluster, which will assign them to individual Servers. WS clients should connect to port 63458; TCP clients should connect to port 63459.

A single `server.js` Server can be added to a cluster by setting its `ipToConnect` to the IP address of the Cluster.

## Examples

A sample project is included in the `ExampleGame` folder.

An early version of this framework was used in [Tiny Headed Game](thkgame.com), a free to play MMO for HTML. The server code is less efficient and uses a different system for sending buffers, but the underlying code base is similar to MMOEngine. This project is deployed on two AWS Elastic Beanstalk accounts, one for the Cluster and one for the Nodes.

For more examples of usage, check out some of the projects on [my website](http://willfarhat.com).

## Contributing
New contributions are welcome! However, before opening any pull requests, please open an Issue so that the proposed changes can be discussed. Since this framework depends on a lot of very specific buffers and package orders, even a small change may have significant effect on the whole framework.


## License
[GNU 3.0](https://www.gnu.org/licenses/lgpl-3.0.html)
