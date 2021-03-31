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

WS clients (HTML5) can access this server on port `wsPort` (63456 by default). TCP clients (other platforms) can access the server on port `TCPPort` (63457 by default). If you want players on different networks to be able to join, you must [Port Forward](https://www.noip.com/support/knowledgebase/general-port-forwarding-guide/) those two ports. 

For a more long term hosting solution, you can upload this file to a NodeJS compatible server host. [AWS Elastic Beanstalk](https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/create_deploy_nodejs.html) is a great option that has worked well for this framework, but some equally viable (and much less complicated) options include [Google Cloud](https://cloud.google.com/nodejs), [A2 Hosting](Cloud.Google.com), and [Azure](https://azure.microsoft.com/en-us/develop/nodejs/).

## Cluster.js Usage

You can run and deploy this script in the same was as `server.js`

When running a Cluster, all players should connect to the Cluster, which will assign them to individual Servers. WS clients should connect to port 63458; TCP clients should connect to port 63459.

A single `server.js` Server can be added to a cluster by setting its `ipToConnect` to the IP address of the Cluster.

## Examples

A sample project is included in the `ExampleGame` folder.

For more fleshed out examples, check out some of the projects on [my website](http://willfarhat.com).

## Contributing
New contributions are welcome! However, before opening any pull requests, please open an Issue so that the proposed changes can be discussed. Since this framework depends on a lot of very specific buffers and package orders, even a small change may have significant effect on the whole framework.


## License
[GNU 3.0](https://www.gnu.org/licenses/lgpl-3.0.html)