'use client'

// ../core-sdk-js/src/localization/locales/en.json
var en_default = {
  jurisdiction: {
    label: "Where are you located?",
    placeholder: "Select your location",
    submit: "Continue",
    subdivisionName: "{country} ({subdivision})"
  },
  age: {
    dateOfBirthLabel: "Your date of birth",
    ageLabel: "How old are you? ({age})",
    submit: "Continue"
  },
  askAnAdult: {
    title: "A grownup needs to say yes",
    description: "Enter their email and we will send them a request to approve your access.",
    emailPlaceholder: "grownup@example.com",
    submit: "Send the request",
    submitting: "Sending...",
    error: "We could not send the request. Please try again.",
    invalidEmail: "We could not send the request. Check the address and try again."
  },
  verifyAge: {
    title: "Verify your age",
    description: "Enter your email and we will send you a link to verify your age.",
    emailPlaceholder: "you@example.com",
    submit: "Send the link",
    submitting: "Sending...",
    error: "We could not send the link. Please try again.",
    invalidEmail: "We could not send the link. Check the address and try again."
  },
  settings: {
    title: "Permissions",
    enabledLabel: "{permission}",
    on: "On",
    off: "Off",
    ask: "Ask",
    added: "Added",
    granted: "Granted",
    askGrownup: "Ask your grownup",
    asking: "Asking your grownup",
    waiting: "Waiting for your grownup to approve",
    verifying: "Check your email to verify your age",
    error: "Something went wrong. Please try again."
  },
  subdivisions: {
    "AU-ACT": "Australian Capital Territory",
    "AU-NSW": "New South Wales",
    "AU-NT": "Northern Territory",
    "AU-QLD": "Queensland",
    "AU-SA": "South Australia",
    "AU-TAS": "Tasmania",
    "AU-VIC": "Victoria",
    "AU-WA": "Western Australia",
    "CA-AB": "Alberta",
    "CA-BC": "British Columbia",
    "CA-MB": "Manitoba",
    "CA-NB": "New Brunswick",
    "CA-NS": "Nova Scotia",
    "CA-ON": "Ontario",
    "CA-QC": "Quebec",
    "CA-SK": "Saskatchewan",
    "PS-GZA": "Gaza Strip",
    "PS-WBK": "West Bank",
    "AE-AZ": "Abu Dhabi",
    "AE-AJ": "Ajman",
    "AE-DU": "Dubai",
    "AE-FU": "Fujairah",
    "AE-RK": "Ras al-Khaimah",
    "AE-SH": "Sharjah",
    "AE-UQ": "Umm al-Quwain",
    "GB-SCT": "Scotland",
    "US-AL": "Alabama",
    "US-AK": "Alaska",
    "US-AS": "American Samoa",
    "US-AZ": "Arizona",
    "US-AR": "Arkansas",
    "US-CA": "California",
    "US-CO": "Colorado",
    "US-CT": "Connecticut",
    "US-DE": "Delaware",
    "US-DC": "District of Columbia",
    "US-FL": "Florida",
    "US-GA": "Georgia",
    "US-GU": "Guam",
    "US-HI": "Hawaii",
    "US-ID": "Idaho",
    "US-IL": "Illinois",
    "US-IN": "Indiana",
    "US-IA": "Iowa",
    "US-KS": "Kansas",
    "US-KY": "Kentucky",
    "US-LA": "Louisiana",
    "US-ME": "Maine",
    "US-MD": "Maryland",
    "US-MA": "Massachusetts",
    "US-MI": "Michigan",
    "US-MN": "Minnesota",
    "US-MS": "Mississippi",
    "US-MO": "Missouri",
    "US-MT": "Montana",
    "US-NE": "Nebraska",
    "US-NV": "Nevada",
    "US-NH": "New Hampshire",
    "US-NJ": "New Jersey",
    "US-NM": "New Mexico",
    "US-NY": "New York",
    "US-NC": "North Carolina",
    "US-ND": "North Dakota",
    "US-MP": "Northern Mariana Islands",
    "US-OH": "Ohio",
    "US-OK": "Oklahoma",
    "US-OR": "Oregon",
    "US-PA": "Pennsylvania",
    "US-PR": "Puerto Rico",
    "US-RI": "Rhode Island",
    "US-SC": "South Carolina",
    "US-SD": "South Dakota",
    "US-TN": "Tennessee",
    "US-TX": "Texas",
    "US-UT": "Utah",
    "US-VT": "Vermont",
    "US-VI": "Virgin Islands",
    "US-VA": "Virginia",
    "US-WA": "Washington",
    "US-WV": "West Virginia",
    "US-WI": "Wisconsin",
    "US-WY": "Wyoming"
  }
};

// ../core-sdk-js/src/localization/permissions/en.json
var en_default2 = {
  multiplayer: {
    name: "Online Multiplayer"
  },
  "leaderboard-and-rankings": {
    name: "Leaderboard and Rankings"
  },
  "join-groups": {
    name: "Join Groups"
  },
  "public-profile": {
    name: "Public Profile"
  },
  "custom-avatar": {
    name: "Custom Avatar"
  },
  "custom-username": {
    name: "Custom Username"
  },
  "text-chat-private": {
    name: "Text Chat (Private)"
  },
  "text-chat-public": {
    name: "Text Chat (Public)"
  },
  "voice-chat": {
    name: "Voice Chat"
  },
  "video-chat": {
    name: "Video Chat"
  },
  "online-status": {
    name: "Online Status"
  },
  "public-friend-list": {
    name: "Public Friend List"
  },
  "send-accept-friend-requests": {
    name: "Send Accept Friend Requests"
  },
  "link-to-third-party-chat": {
    name: "Link to Third Party Chat"
  },
  "virtual-events": {
    name: "Virtual Events"
  },
  "personalized-recommendations": {
    name: "Personalized Recommendations"
  },
  "targeted-ads": {
    name: "Targeted Ads"
  },
  profiling: {
    name: "Profiling"
  },
  "push-notifications": {
    name: "Push Notifications"
  },
  "share-to-social-media": {
    name: "Share to Social Media"
  },
  "direct-marketing": {
    name: "Direct Marketing"
  },
  forums: {
    name: "Forums"
  },
  "in-game-purchases": {
    name: "In-App Purchases"
  },
  "loot-boxes-paid-cosmetic-only": {
    name: "Loot Boxes Paid Cosmetic Only"
  },
  "loot-boxes-paid-gameplay-impacting": {
    name: "Loot Boxes Paid Usage Impacting"
  },
  "loot-boxes-kompu-gacha": {
    name: "Loot Boxes Kompu Gacha"
  },
  "loot-boxes-paid-open-loop": {
    name: "Loot Boxes Paid Open Loop"
  },
  "send-gifts": {
    name: "Send Gifts"
  },
  "simulated-gambling": {
    name: "Simulated Gambling"
  },
  "virtual-property-ownership": {
    name: "Virtual Property Ownership"
  },
  "camera-access": {
    name: "Camera Access"
  },
  "share-game-clips-screenshots": {
    name: "Share App Clips Screenshots"
  },
  "photo-video-sharing": {
    name: "Photo Video Sharing"
  },
  "real-time-location-sharing": {
    name: "Precise Location Sharing"
  },
  mods: {
    name: "User-Generated Content"
  },
  "gameplay-streaming": {
    name: "Streaming"
  },
  "gameplay-recording": {
    name: "Recording"
  },
  "link-to-third-party-streaming-app": {
    name: "Link to Third-Party Streaming App"
  },
  "ai-chat": {
    name: "AI Chat"
  },
  "ai-voice-mode": {
    name: "AI Voice Mode"
  },
  "ai-memory": {
    name: "AI Memory"
  },
  "ai-media-generation": {
    name: "AI Media Generation"
  },
  "ai-model-training": {
    name: "AI Model Training"
  },
  "ai-companion-chatbot": {
    name: "AI Companion Chatbot"
  },
  "ai-media-upload": {
    name: "AI Media Upload"
  },
  "ai-text-chat": {
    name: "AI Text Chat"
  },
  "ai-image-generation": {
    name: "AI Image Generation"
  },
  "ai-video-generation": {
    name: "AI Video Generation"
  },
  "ai-web-browsing": {
    name: "AI Web Browsing"
  },
  "ai-code-execution": {
    name: "AI Code Execution"
  },
  "ai-tool-use": {
    name: "AI Tool Use"
  },
  "ai-custom-models": {
    name: "AI Custom Models"
  },
  "ai-generated-avatars": {
    name: "AI Generated Avatars"
  },
  "augmented-reality": {
    name: "Augmented Reality"
  },
  "mature-language": {
    name: "Mature Language"
  },
  "motion-data": {
    name: "Motion Data"
  },
  "ai-chatbot": {
    name: "AI Chatbot"
  },
  pvp: {
    name: "PvP"
  },
  "chat-rooms-public": {
    name: "Chat Rooms (Public)"
  },
  "link-to-social-media-account": {
    name: "Link to Social Media Account"
  },
  auctions: {
    name: "Auctions"
  },
  "virtual-marketplace": {
    name: "Virtual Marketplace"
  },
  "contextual-ads": {
    name: "Contextual Ads"
  },
  "restricted-advertising-content": {
    name: "Restricted Advertising Content"
  },
  "disable-safety-prompts": {
    name: "Disable Safety Prompts"
  }
};

// ../core-sdk-js/src/localization/en.ts
var en = { ...en_default, permissions: en_default2 };

export {
  en
};
//# sourceMappingURL=chunk-CWMEMPDF.js.map