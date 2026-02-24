import { Schema, model, type InferSchemaType } from 'mongoose';

const usersSchema = new Schema(
  {
    email: { type: String, required: true, trim: true, lowercase: true },
    username: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    roles: { type: [String], default: ['player'] },
    lastSeenAt: { type: Date },
    preferences: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

usersSchema.index({ email: 1 }, { unique: true });
usersSchema.index({ username: 1 }, { unique: true });

const roomsSchema = new Schema(
  {
    code: { type: String, required: true, uppercase: true, trim: true },
    hostUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    visibility: { type: String, enum: ['public', 'private'], required: true, default: 'private' },
    passwordHash: { type: String },
    status: { type: String, enum: ['lobby', 'active', 'finished'], default: 'lobby' },
    config: {
      roundDurationSec: { type: Number, default: 60 },
      maxPlayers: { type: Number, default: 20 },
      aiProvider: { type: String, default: 'gemini-1.5-pro' },
    },
    currentRoundId: { type: Schema.Types.ObjectId, ref: 'Round' },
  },
  { timestamps: true, versionKey: false },
);

roomsSchema.index({ code: 1 }, { unique: true });
roomsSchema.index({ status: 1, updatedAt: -1 });

const roomMembersSchema = new Schema(
  {
    roomId: { type: Schema.Types.ObjectId, ref: 'Room', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    joinedAt: { type: Date, default: Date.now },
    role: { type: String, enum: ['host', 'player', 'spectator'], default: 'player' },
  },
  { versionKey: false },
);

roomMembersSchema.index({ roomId: 1, userId: 1 }, { unique: true });

const categoriesSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    answers: { type: [String], required: true, default: [] },
    source: { type: String, enum: ['ai', 'manual'], required: true, default: 'manual' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    language: { type: String, required: true, default: 'en' },
    safetyFlags: { type: [String], default: [] },
    isPublic: { type: Boolean, default: true },
    version: { type: Number, default: 1 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

categoriesSchema.index({ slug: 1, language: 1, version: 1 }, { unique: true });

const roundsSchema = new Schema(
  {
    roomId: { type: Schema.Types.ObjectId, ref: 'Room', required: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date },
    status: { type: String, enum: ['countdown', 'active', 'ended'], default: 'countdown' },
    answerPoolHash: { type: String, required: true },
    foundAnswers: { type: [String], default: [] },
    scoreboard: { type: [Schema.Types.Mixed], default: [] },
    configSnapshot: { type: Schema.Types.Mixed, default: {} },
  },
  { versionKey: false },
);

roundsSchema.index({ roomId: 1, startedAt: -1 });

const answersSubmittedSchema = new Schema(
  {
    roundId: { type: Schema.Types.ObjectId, ref: 'Round', required: true },
    roomId: { type: Schema.Types.ObjectId, ref: 'Room', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    rawInput: { type: String, required: true },
    normalizedInput: { type: String, required: true },
    isValid: { type: Boolean, required: true },
    isDuplicate: { type: Boolean, required: true },
    serverReceivedAt: { type: Date, required: true },
    latencyBucketMs: { type: Number, required: true },
    pointsAwarded: { type: Number, required: true, default: 0 },
  },
  { versionKey: false },
);

answersSubmittedSchema.index({ roundId: 1, normalizedInput: 1 });

const savedCategorySetsSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    categoryIds: { type: [Schema.Types.ObjectId], ref: 'Category', default: [] },
    isPublic: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

const authSessionsSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    refreshTokenHash: { type: String, required: true },
    userAgent: { type: String },
    ipAddress: { type: String },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

authSessionsSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const abuseEventsSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    roomId: { type: Schema.Types.ObjectId, ref: 'Room' },
    eventType: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, default: {} },
    severity: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

abuseEventsSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

export const UserModel = model('User', usersSchema);
export const RoomModel = model('Room', roomsSchema);
export const RoomMemberModel = model('RoomMember', roomMembersSchema);
export const CategoryModel = model('Category', categoriesSchema);
export const RoundModel = model('Round', roundsSchema);
export const AnswerSubmittedModel = model('AnswerSubmitted', answersSubmittedSchema);
export const SavedCategorySetModel = model('SavedCategorySet', savedCategorySetsSchema);
export const AuthSessionModel = model('AuthSession', authSessionsSchema);
export const AbuseEventModel = model('AbuseEvent', abuseEventsSchema);

export type UserDocument = InferSchemaType<typeof usersSchema>;
export type RoomDocument = InferSchemaType<typeof roomsSchema>;
export type RoomMemberDocument = InferSchemaType<typeof roomMembersSchema>;
export type CategoryDocument = InferSchemaType<typeof categoriesSchema>;
export type RoundDocument = InferSchemaType<typeof roundsSchema>;
export type AnswerSubmittedDocument = InferSchemaType<typeof answersSubmittedSchema>;
export type SavedCategorySetDocument = InferSchemaType<typeof savedCategorySetsSchema>;
export type AuthSessionDocument = InferSchemaType<typeof authSessionsSchema>;
export type AbuseEventDocument = InferSchemaType<typeof abuseEventsSchema>;
