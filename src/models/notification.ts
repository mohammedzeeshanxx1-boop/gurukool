import { Schema, models, model } from "mongoose";

// Persistent in-app notifications, addressed to a User account.
const NotificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, maxlength: 140 },
    body: { type: String, default: "", maxlength: 500 },
    link: { type: String, default: "" },
    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);
export const Notification = models.Notification || model("Notification", NotificationSchema);
