// models/SquadJoinRequest.js

import mongoose from "mongoose";

const SquadJoinRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    squadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Squad",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },
    message: {
      type: String,
    },
  },
  { timestamps: true }
);

export default mongoose.model("SquadJoinRequest", SquadJoinRequestSchema);
