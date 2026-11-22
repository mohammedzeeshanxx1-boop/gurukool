import { Schema, models, model, type InferSchemaType } from "mongoose";

// A study session one student requests with another. Students are identified by Student.key.
const PeerSessionSchema = new Schema(
  {
    requesterKey: { type: String, required: true, index: true },
    requesterName: { type: String, required: true, maxlength: 100 },
    peerKey: { type: String, required: true, index: true },
    peerName: { type: String, required: true, maxlength: 100 },
    topic: { type: String, required: true, maxlength: 120 },
    message: { type: String, default: "", maxlength: 500 },
    startAt: { type: Date, required: true, index: true },
    durationMinutes: { type: Number, required: true },
    status: { type: String, enum: ["PENDING", "ACCEPTED", "DECLINED", "CANCELLED"], default: "PENDING", index: true },
    roomCode: { type: String, default: "" },
    respondedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export type PeerSessionDoc = InferSchemaType<typeof PeerSessionSchema> & { _id: unknown };
export const PeerSession = models.PeerSession || model("PeerSession", PeerSessionSchema);
