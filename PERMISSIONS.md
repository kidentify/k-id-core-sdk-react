# k-ID permissions

The capabilities a game can declare. Pass the `name` (the ID) of each capability your app uses in the
`declare.permissions` array on `<KidCoreProvider>`; k-ID turns the declared set into your permission set.
Descriptions are the parent-facing copy shown to trusted adults.

49 permissions across 6 groups.

## Social

| ID (`name`) | Name | Description |
| --- | --- | --- |
| `multiplayer` | Online Multiplayer | Your child can interact with one or more other users online. |
| `leaderboard-and-rankings` | Leaderboard and Rankings | Your child can participate in competitive leaderboards, where their username and profile picture may be visible to others. |
| `join-groups` | Join Groups | Your child can join and interact with persistent user groups, such as guilds or clans, within the app. |
| `public-profile` | Public Profile | Your child can create a public profile that is visible to others, which may include personal information. |
| `custom-avatar` | Custom Avatar | Your child can create an avatar in the app to represent themselves to others. |
| `custom-username` | Custom Username | Your child can create a unique username visible to others. |
| `text-chat-private` | Text Chat (Private) | Your child can communicate freely with others through direct messages. |
| `text-chat-public` | Text Chat (Public) | Your child can engage in 1-to-many free-form communications with other users. |
| `voice-chat` | Voice Chat | Your child can talk to others using their voice. |
| `video-chat` | Video Chat | Your child can have video conversations with others. |
| `online-status` | Online Status | Others will be able to see when your child is online. |
| `public-friend-list` | Public Friend List | Your child's list of friends will be visible to others. |
| `send-accept-friend-requests` | Send Accept Friend Requests | Your child can send and accept friend requests from others. |
| `link-to-third-party-chat` | Link to Third Party Chat | Your child can access and use an external chat app to communicate outside of the app. |
| `virtual-events` | Virtual Events | Your child can join special limited-time online activities hosted within the virtual experience. |
| `share-to-social-media` | Share to Social Media | Your child can share content to social media. |

## Marketing

| ID (`name`) | Name | Description |
| --- | --- | --- |
| `personalized-recommendations` | Personalized Recommendations | Your child can receive personalized content and recommendations based on their profile. |
| `targeted-ads` | Targeted Ads | Your child will see ads within the app and on other platforms that are tailored to their interests. |
| `profiling` | Profiling | Your child's activity will be analyzed to predict their behavior and preferences. |
| `push-notifications` | Push Notifications | Your child will receive notifications on their device from the app, even when the app is not actively in use. |
| `direct-marketing` | Direct Marketing | Your child may provide their contact information to the publisher to receive marketing communications. |
| `forums` | Forums | Your child can join forums where posts will be visible outside of the app. |
| `restricted-advertising-content` | Restricted Advertising Content | Your child may see advertising content that does not meet the heightened content standards for minors. |

## Commerce

| ID (`name`) | Name | Description |
| --- | --- | --- |
| `in-game-purchases` | In-App Purchases | Your child can use real money to buy items or content within the app. |
| `loot-boxes-paid-cosmetic-only` | Loot Boxes Paid Cosmetic Only | Your child can purchase items that provide randomized cosmetic rewards such as outfits or skins. |
| `loot-boxes-paid-gameplay-impacting` | Loot Boxes Paid Usage Impacting | Your child can spend money to buy randomized items that can affect how the app is used, such as better equipment or abilities. |
| `loot-boxes-kompu-gacha` | Loot Boxes Kompu Gacha | Your child can participate in Kompu Gacha. |
| `loot-boxes-paid-open-loop` | Loot Boxes Paid Open Loop | Your child can spend real money to receive randomized in-app rewards, which can then be exchanged for real money. |
| `send-gifts` | Send Gifts | Your child can send and receive in-app items to and from others as gifts. |
| `simulated-gambling` | Simulated Gambling | Your child can encounter mechanics that simulate the experience of gambling, such as chips, dice, or slot machines. |
| `virtual-property-ownership` | Virtual Property Ownership | Your child can sell or trade virtual items to others for real-world money or other valuable digital assets. |

## Create content / share data

| ID (`name`) | Name | Description |
| --- | --- | --- |
| `camera-access` | Camera Access | Your child can allow access to their device's camera. |
| `share-game-clips-screenshots` | Share App Clips Screenshots | Your child can share their recorded app clips and screenshots with others. |
| `photo-video-sharing` | Photo Video Sharing | Your child can upload and share photos or videos with others. |
| `real-time-location-sharing` | Precise Location Sharing | Your child can share their precise location, such as street level or even specific coordinates, with others. |
| `mods` | User-Generated Content | Your child can create and share custom content, and see custom content shared by others. |
| `gameplay-streaming` | Streaming | Your child's app usage can be broadcast live for others to watch. |
| `gameplay-recording` | Recording | Your child can record their app usage sessions and upload them online. |
| `link-to-third-party-streaming-app` | Link to Third-Party Streaming App | Your child can connect their app account to an external streaming platform. |

## AI

| ID (`name`) | Name | Description |
| --- | --- | --- |
| `ai-chat` | AI Chat | Your child can freely communicate with a feature that uses generative AI, such as for interactivity or support functions. |
| `ai-voice-mode` | AI Voice Mode | Your child can interact with an AI using their voice in real-time conversations. |
| `ai-memory` | AI Memory | Your child's preferences and interactions with an AI will be retained and used to create a profile of their experience over time. |
| `ai-media-generation` | AI Media Generation | Your child can interact with an AI that may generate images, and/or video based on the child's prompt. |
| `ai-model-training` | AI Model Training | Your child's information and inputs will be used to train an AI model. |
| `ai-companion-chatbot` | AI Companion Chatbot | Your child can interact with AI characters or companions that mimic human interaction through personalized content. |
| `ai-media-upload` | AI Media Upload | Your child can provide an image, video, or other media as part of their interactions with AI. |

## Advanced

| ID (`name`) | Name | Description |
| --- | --- | --- |
| `augmented-reality` | Augmented Reality | Your child can use features that blend the virtual world with their real environment using the device's camera. |
| `mature-language` | Mature Language | Your child may encounter mature content in the app. (This does not cover interactions with other users.) |
| `motion-data` | Motion Data | Your child's device can upload motion data, such as movement and physical activity, to the app. |
