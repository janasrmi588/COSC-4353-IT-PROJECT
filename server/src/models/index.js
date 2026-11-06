// Registers every model with Mongoose. Each model file registers itself when
// it is imported, so nobody needs to edit this file when they fill theirs in.
// Anything that needs the models (the server, the seed script) imports this.
import "./UserCredentials.js";
import "./UserProfile.js";
import "./Service.js";
import "./Queue.js";
import "./QueueEntry.js";
import "./Notification.js";
