const mongoose = require('mongoose');

const ProfileSchema = new mongoose.Schema(
  {
    publicIdentifier: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
      trim: true
    },
    urn: { type: String, default: '' },
    fullName: { type: String, default: '' },
    firstName: { type: String, default: '' },
    lastName: { type: String, default: '' },
    headline: { type: String, default: '' },
    location: { type: String, default: '' },
    about: { type: String, default: '' },
    profilePicture: { type: String, default: null },
    backgroundPicture: { type: String, default: null },
    experience: [
      {
        title: String,
        company: String,
        companyLogo: String,
        location: String,
        dateRange: String,
        startDate: String,
        endDate: String,
        description: String,
        employmentType: String
      }
    ],
    education: [
      {
        schoolName: String,
        degreeName: String,
        fieldOfStudy: String,
        dateRange: String,
        startDate: String,
        endDate: String,
        description: String,
        schoolLogo: String
      }
    ],
    skills: [
      {
        name: String,
        endorsementsCount: { type: Number, default: 0 }
      }
    ],
    certifications: [
      {
        name: String,
        authority: String,
        url: String,
        dateRange: String,
        licenseNumber: String
      }
    ],
    languages: [
      {
        name: String,
        proficiency: String
      }
    ],
    honors: { type: Array, default: [] },
    projects: { type: Array, default: [] },
    stats: { type: Object, default: {} },
    lastScrapedAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// Compound index for fast history queries and public identifier lookups
ProfileSchema.index({ lastScrapedAt: -1 });

module.exports = mongoose.models.Profile || mongoose.model('Profile', ProfileSchema);
