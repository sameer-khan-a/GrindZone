// models/SquadJoinRequest.js
import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

const SquadJoinRequestSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    squadId: { type: Schema.Types.ObjectId, ref: "Squad", required: true },
    status: { type: String, enum: ["pending", "accepted", "rejected", "invited"], default: "pending" },
    message: { type: String },
    invitedBy: { type: Schema.Types.ObjectId, ref: "User" }, // optional: who invited/created
  },
  { timestamps: true }
);

// Prevent duplicates at DB level (userId + squadId should be unique)
SquadJoinRequestSchema.index({ userId: 1, squadId: 1 }, { unique: true });

export default models.SquadJoinRequest || model("SquadJoinRequest", SquadJoinRequestSchema);
