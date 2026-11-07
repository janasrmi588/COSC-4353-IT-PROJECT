import Session from "../../models/Session.js";
import UserCredentials from "../../models/UserCredentials.js";

import { hashToken } from "./auth.service.js";

export async function requireAuth(req, res, next) {
  const authorization = req.get("Authorization") || "";
  const match = /^Bearer ([a-f0-9]{64})$/.exec(authorization);

  if (!match) {
    return res.status(401).json({
      message: "Please log in first.",
    });
  }

  try {
    const session = await Session.findOne({
      tokenHash: hashToken(match[1]),
      expiresAt: { $gt: new Date() },
    });

    if (!session) {
      return res.status(401).json({
        message: "Your session has expired. Please log in again.",
      });
    }

    const user = await UserCredentials.findById(session.userId);

    if (!user) {
      return res.status(401).json({
        message: "Your account could not be found. Please log in again.",
      });
    }

    req.user = user;
    req.sessionId = session._id;

    return next();
  } catch (error) {
    return next(error);
  }
}