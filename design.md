# Aetheria AI - Design System Documentation

## Overview
Aetheria AI is a Progressive Web App (PWA) featuring a sophisticated AI chat interface with a clean, minimalist design philosophy. The application emphasizes clarity, accessibility, and smooth interactions while maintaining a professional aesthetic.

---

## Design Philosophy

### Core Principles
1. **Minimalism** - Clean interfaces with purposeful elements
2. **Clarity** - Clear visual hierarchy and readable typography
3. **Consistency** - Unified design language across all components
4. **Accessibility** - WCAG compliant with keyboard navigation support
5. **Performance** - Optimized animations and efficient rendering
6. **Responsiveness** - Seamless experience across all devices

---

## Color System

### Theme Architecture
The application features a sophisticated dual-theme system (Light/Dark) with a carefully curated neutral grayscale palette, ensuring optimal readability and visual comfort in all lighting conditions. The theming system uses CSS custom properties for seamless theme switching.

#### Light Mode
- **Background**: `#FAF8F0` (Warm cream) - Provides a soft, paper-like feel
- **Elevated Surface**: `#FFFFFF` (Pure white) - For cards and floating elements
- **Primary Text**: `#111827` (Near black) - High contrast for readability
- **Secondary Text**: `#4b5563` (Medium gray) - For less prominent text
- **Borders**: `#EAE0C8` (Soft beige) - Subtle separation between elements
- **Accent**: `#374151` (Dark gray) - Primary interactive elements
- **Message Bubbles**: 
  - User: `#1f2937` (Dark gray)
  - Bot: `#F5F3EB` (Light beige)
- **Shadows**: Subtle drop shadows for depth (4px blur, 0.08 opacity)

#### Dark Mode
- **Background**: `#1a1a1a` (Dark gray) - Reduces eye strain in low light
- **Elevated Surface**: `#242424` (Darker gray) - For cards and floating elements
- **Primary Text**: `#f9fafb` (Off white) - High contrast for readability
- **Secondary Text**: `#9ca3af` (Light gray) - For less prominent text
- **Borders**: `#3a3a3a` (Dark gray) - Subtle separation between elements
- **Accent**: `#e5e7eb` (Light gray) - Primary interactive elements
- **Message Bubbles**:
  - User: `#e5e7eb` (Light gray)
  - Bot: `#2e2e2e` (Dark gray)
- **Shadows**: Deeper shadows with higher opacity (6px blur, 0.15 opacity)

#### Theme Switching
- **Automatic**: Respects system preference
- **Manual**: User can override in settings
- **Transition**: Smooth 0.3s transition for all theme changes
- **Persistence**: User preference is saved to localStorage

#### Accessibility
- **Contrast Ratio**: Minimum 4.5:1 for normal text (WCAG AA)
- **Focus States**: High visibility focus rings
- **Reduced Motion**: Respects user preferences for animations
- **Text Scaling**: Supports up to 200% without loss of content or functionality

### Status Colors
- **Success**: `#10b981` (Green)
- **Warning**: `#f59e0b` (Amber)
- **Error**: `#ef4444` (Red)

## Typography

### Font Families
- **Primary (UI)**: System UI, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif
- **Monospace (Code)**: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace
- **Welcome Screen**: Georgia, serif

### Fluid Typography Scale
- `--text-xs`: `clamp(0.75rem, 0.7vw, 0.85rem)`
- `--text-sm`: `clamp(0.875rem, 0.8vw, 0.95rem)`
- `--text-base`: `clamp(1rem, 0.9vw, 1.1rem)`
- `--text-lg`: `clamp(1.125rem, 1.1vw, 1.25rem)`
- `--text-xl`: `clamp(1.25rem, 1.3vw, 1.5rem)`
- `--text-2xl`: `clamp(1.5rem, 1.6vw, 1.875rem)`
- `--text-3xl`: `clamp(1.875rem, 2vw, 2.25rem)`

## UI Components

### 1. Chat Interface
- **Input Area**: Fixed at bottom with floating design
- **Message Bubbles**: Rounded corners, different styles for user/bot
- **Attachments**: Inline preview with horizontal scrolling
- **Typing Indicators**: Subtle animation for bot responses

### 2. Buttons
- **Primary**: Solid buttons with high contrast
- **Secondary**: Outlined or ghost buttons
- **Icon Buttons**: Circular with consistent padding
- **Floating Action Buttons (FAB)**: For primary actions

### 3. Inputs
- **Text Input**: Rounded, with clean borders
- **File Input**: Drag-and-drop support with preview chips
- **Search**: Rounded search bar with icon
- **Dropdowns**: Animated, with smooth transitions

### 4. Navigation
- **Top Bar**: Minimal design with app title and actions
- **Bottom Navigation**: Fixed navigation for main sections
- **Sidebar**: Slide-out menu for additional options

### 5. Cards & Containers
- **Message Cards**: Rounded corners with subtle shadows
- **Info Cards**: Light background with border
- **Modal Dialogs**: Centered with dimmed background

## Icons & Assets

### Icon Libraries
- **Flaticon Thin Rounded Icons** (`fi-` prefix)
- **Font Awesome 6.4.0** (`fa-` prefix)
  - Solid (`fas-`)
  - Regular (`far-`)
  - Brands (`fab-`)

### Icon Usage Guide

#### Message Actions
- `fi-tr-copy` - Copy message content
- `fi-tr-share-square` - Share message
- `fi-tr-check-circle` - Success confirmation
- `fi-tr-edit` - Edit message
- `fi-tr-refresh` - Regenerate response

#### Navigation & Primary Actions
- `fi-tr-comment-medical` - New chat
- `fi-tr-rectangle-vertical-history` - Chat history
- `fi-tr-mail-plus-circle` - New task
- `fa-regular fa-plus` - Add/expand
- `fa-arrow-left` - Back navigation
- `fa-chevron-right` - Menu item indicator
- `fa-chevron-down` - Expand content
- `fa-chevron-up` - Collapse content

#### User & Account
- `fi-tr-circle-user` - User profile/avatar
- `fi-tr-sign-out-alt` - Logout
- `fab fa-google` - Google authentication
- `fa-regular fa-user` - User account

#### File & Content
- `fas fa-paperclip` - Attach files
- `fas fa-download` - Download content
- `fas fa-expand` - Fullscreen view
- `fas fa-times` - Close/clear
- `fas fa-sync-alt` - Refresh/sync
- `fa-file` - Generic file
- `fa-file-pdf` - PDF document
- `fa-file-word` - Word document
- `fa-file-image` - Image file

#### Context & Tools
- `fi-tr-brain` - Memory/context
- `fi-tr-layer-plus` - Integrations
- `fa-network-wired` - Connections
- `fa-code` - Code blocks
- `fa-search` - Search functionality

#### Settings & Info
- `fi-tr-circle-half-stroke` - Theme settings
- `fi-tr-information` - Information
- `fa-regular fa-circle-question` - Help/support
- `fa-cog` - Settings

#### Status Indicators
- `fa-spin` - Loading state
- `fa-check-circle` - Success state
- `fa-exclamation-circle` - Error state
- `fa-info-circle` - Information

#### Message Status
- `fa-check` - Message delivered
- `fa-check-double` - Message read
- `fa-clock` - Message sending
- `fa-exclamation-triangle` - Message failed

### Icon Sizing
- **Small**: 16px (0.875rem)
- **Medium**: 20px (1.25rem)
- **Large**: 24px (1.5rem)
- **X-Large**: 32px (2rem)

### Icon Colors
- **Primary**: `var(--text-color)`
- **Secondary**: `var(--text-secondary)`
- **Accent**: `var(--accent-color)`
- **Success**: `var(--success-500)`
- **Warning**: `var(--warning-500)`
- **Error**: `var(--error-500)`

### Best Practices
1. Always include appropriate ARIA labels for icons without text
2. Use consistent icon weights within the same interface
3. Maintain consistent padding around icons
4. Use the appropriate icon size for the context
5. Ensure sufficient contrast with the background
6. Provide tooltips for icon-only buttons

### Custom Icons
For app-specific icons not available in the standard sets, custom SVG icons are used. These are optimized for:
- Performance (minified SVG)
- Accessibility (proper ARIA attributes)
- Scalability (vector-based)
- Theming (CSS variable support)

### Icon Animation
- **Hover**: Slight scale (1.1x)
- **Active**: Slight scale (0.95x)
- **Loading**: Continuous rotation
- **Success/Failure**: Brief scale and color change

## Animations & Transitions
- **Page Transitions**: Smooth fade/slide effects
- **Button Press**: Subtle scale animation
- **Loading States**: Skeleton loaders for content
- **Message Send/Receive**: Smooth entry/exit animations

## Layout & Spacing
- **Grid System**: Flexible grid with consistent gutters
- **Spacing Scale**: Based on 4px increments (4px, 8px, 12px, 16px, 24px, 32px, 48px, 64px)
- **Container Widths**: Responsive with max-width constraints

## Accessibility
- **Color Contrast**: WCAG AA/AAA compliant
- **Focus States**: Visible focus indicators
- **Text Scaling**: Supports dynamic type
- **Reduced Motion**: Respects system preferences

## Dark Mode
- Automatic switching based on system preference
- Smooth transitions between modes
- Adjusted colors for optimal contrast and readability

## Interactive Elements
- **Hover States**: Subtle opacity/color changes
- **Active States**: Visual feedback on touch/click
- **Disabled States**: Clearly indicate non-interactive elements

## File Handling
- **Attachment Previews**: Thumbnails for images/documents
- **Upload Progress**: Visual indicators
- **File Types**: Icons for different file formats

## Notifications
- **Toast Notifications**: Non-intrusive, auto-dismissing
- **Badges**: For unread counts
- **System Alerts**: For important information

## Responsive Design
- **Mobile-First**: Optimized for small screens
- **Tablet**: Adjusted layouts for medium screens
- **Desktop**: Enhanced experience for larger screens

## Performance Considerations
- **Lazy Loading**: For images and non-critical assets
- **Optimized Animations**: Using hardware acceleration
- **Efficient Rendering**: Virtualized lists for long contents

## Layout System

### Structure
```
┌─────────────────────────────────────┐
│         Top Bar (60px)              │ ← Fixed header
├─────────────────────────────────────┤
│                                     │
│         Main Content                │ ← Scrollable
│         (Chat Messages)             │
│                                     │
├─────────────────────────────────────┤
│      Bottom UI Container            │ ← Fixed footer
│      (Input + Attachments)          │
└─────────────────────────────────────┘
```

### Spacing System
- **Base Unit**: 4px
- **Scale**: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64px
- **Container Padding**: 16px (mobile), 20px (desktop)
- **Component Gap**: 8-16px

### Breakpoints
- **Mobile**: < 768px
- **Tablet**: 768px - 1024px
- **Desktop**: > 1024px

---

## Components

### 1. Top Bar
**Purpose**: Primary navigation and user actions

**Features**:
- New chat/task creation dropdown
- Profile menu with settings access
- Minimal 60px height
- Glassmorphism effect on scroll

**Interactions**:
- Hover: Background color change
- Active: Scale down (0.98)
- Dropdown: Slide-in animation (0.3s cubic-bezier)

### 2. Chat Messages
**Purpose**: Display conversation history

**Message Types**:
- **User Messages**: Right-aligned, dark background
- **Bot Messages**: Left-aligned, light background
- **System Messages**: Centered, muted

**Features**:
- Markdown rendering with syntax highlighting
- Collapsible code blocks
- Inline Mermaid diagrams
- Context indicators
- Reasoning summaries
- **Message Actions**: Copy and Share buttons (mobile-optimized)

**Message Actions**:
- **Copy Button**: Copies entire message to clipboard
  - Icon: `fi fi-tr-copy`
  - Success feedback: Checkmark icon for 2s
  - Haptic feedback on mobile
- **Share Button**: Native Web Share API (mobile) with copy fallback
  - Icon: `fi fi-tr-share-square`
  - Falls back to copy on unsupported browsers
- **Visibility**: Actions appear on last message or when message is in viewport
- **Touch-optimized**: 32px minimum tap targets

**Animations**:
- Fade-in: 0.3s ease
- Typing indicator: Pulsing dots
- Scroll: Smooth behavior
- Action buttons: Fade-in on viewport entry

### 3. Input Area
**Purpose**: Message composition and file attachment

**Components**:
- Circular action buttons (44px)
- Auto-expanding textarea (52px - 200px)
- Attachment strip (horizontal scroll)
- Action menu (Memory, Attach, Chats)

**States**:
- **Default**: White/dark background
- **Focus**: Border highlight
- **Sending**: Disabled with loading state
- **Error**: Red border

**Animations**:
- Button hover: translateY(-1px)
- Send button: Icon swap (plane ↔ circle)
- Menu: Slide-up (0.3s)

### 4. Notifications
**Purpose**: System feedback and status updates

**Design**: Glassmorphism pill-shaped toasts

**Light Mode**:
- Background: `rgba(50, 50, 50, 0.75)`
- Backdrop blur: 20px
- Border: `rgba(80, 80, 80, 0.3)`

**Dark Mode**:
- Background: `rgba(245, 245, 220, 0.85)`
- Text: Dark gray
- Border: `rgba(255, 255, 240, 0.3)`

**Position**: Top-center, stacked vertically

**Animations**:
- Enter: translateY(-20px) → 0, scale(0.95) → 1
- Exit: Reverse
- Duration: 0.3s cubic-bezier(0.4, 0, 0.2, 1)

### 5. Modals & Overlays
**Purpose**: Context viewers, settings, task management

**Structure**:
- Full-screen overlay: `rgba(0, 0, 0, 0.6)` + blur(4px)
- Panel: Rounded corners (12-16px)
- Header: Fixed with close button
- Content: Scrollable
- Footer: Actions (if needed)

**Animations**:
- Mobile: Slide-up from bottom
- Desktop: Scale + fade (0.95 → 1)
- Duration: 0.3-0.35s

### 6. Code Blocks
**Purpose**: Display formatted code with syntax highlighting

**Features**:
- Collapsible header with language badge
- Line count indicator
- Copy button with success feedback
- Syntax highlighting (highlight.js)
- Chevron rotation on toggle

**States**:
- **Collapsed**: Header only
- **Expanded**: Full code visible
- **Copying**: Checkmark icon (2s)

### 7. Mermaid Diagrams
**Purpose**: Interactive diagram rendering

**Features**:
- Inline preview with pan/zoom
- Source code toggle
- Full-size artifact view
- Interactive controls

**Interactions**:
- Drag to pan
- Scroll to zoom
- Double-click to reset
- Touch gestures supported

### 8. Context Viewer
**Purpose**: Display attached files and session history

**Design**: Bottom sheet (mobile) / Modal (desktop)

**Tabs**:
- Sessions: Chip-based navigation
- Files: List with preview buttons

**Animations**:
- Sheet: translateY(100%) → 0
- Chips: Scale on tap (0.98)
- Duration: 0.35s cubic-bezier

### 9. Profile Dropdown
**Purpose**: User account and settings access

**Sections**:
- Account (Login/Profile)
- Integrations
- Profile Info
- Theme Settings
- About & Support

**Design**:
- Width: 360px (max 90vw)
- Max height: 75vh
- Rounded: 16px
- Shadow: Elevated

**Animation**: Slide-in from top-right (0.3s)

### 10. Splash Screen
**Purpose**: Loading state during app initialization

**Features**:
- Animated logo with glow effect
- Particle system (gray particles)
- Progress bar with gradient
- Loading text with percentage
- Brand name underline animation

**Colors**: Neutral grays (no blue)

---

## Animations & Transitions

### Timing Functions
```css
--easing-standard: cubic-bezier(0.4, 0, 0.2, 1)
--easing-decelerate: cubic-bezier(0, 0, 0.2, 1)
--easing-accelerate: cubic-bezier(0.4, 0, 1, 1)
```

### Duration Scale
- **Fast**: 0.2s (hover, focus)
- **Normal**: 0.3s (modals, dropdowns)
- **Slow**: 0.4s (page transitions)

### Key Animations

#### 1. Fade In
```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

#### 2. Slide In Up
```css
@keyframes slideInUp {
  from {
    transform: translateY(10px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
```

#### 3. Bounce In
```css
@keyframes bounceIn {
  0% {
    transform: scale(0.8);
    opacity: 0;
  }
  80% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}
```

#### 4. Pulse (Loading)
```css
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
```

#### 5. Shimmer (Skeleton)
```css
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
```

### Interaction Patterns

#### Buttons
- **Hover**: translateY(-1px) + shadow increase
- **Active**: translateY(0) + scale(0.98)
- **Focus**: Outline ring (2px accent color)

#### Cards
- **Hover**: translateY(-2px) + shadow elevation
- **Active**: Scale(0.98)

#### Dropdowns
- **Enter**: Slide + fade (0.3s)
- **Exit**: Reverse

---

## Accessibility

### ARIA Implementation
- **Buttons**: `role="button"`, `aria-label`, `aria-pressed`
- **Dropdowns**: `aria-haspopup`, `aria-expanded`
- **Modals**: `role="dialog"`, `aria-modal="true"`
- **Tabs**: `role="tablist"`, `role="tab"`, `aria-selected`
- **Live Regions**: `aria-live="polite"` for notifications

### Keyboard Navigation
- **Tab**: Focus traversal
- **Enter/Space**: Activate buttons
- **Escape**: Close modals/dropdowns
- **Arrow Keys**: Navigate lists/tabs

### Focus Management
- Visible focus indicators (2px outline)
- Focus trap in modals
- Restore focus on close

### Color Contrast
- **Normal Text**: 4.5:1 minimum
- **Large Text**: 3:1 minimum
- **Interactive Elements**: 3:1 minimum

### Reduced Motion
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Responsive Design

### Mobile Optimizations
- Touch-friendly targets (44px minimum)
- Bottom sheet modals
- Horizontal scroll for attachments
- Simplified navigation
- Larger tap areas
- Safe area insets support

### Tablet Adaptations
- Hybrid layout (mobile + desktop features)
- Adaptive grid columns
- Flexible spacing

### Desktop Enhancements
- Hover states
- Keyboard shortcuts
- Multi-column layouts
- Larger modals
- Sidebar navigation (if applicable)

---

## Performance Optimizations

### CSS
- Hardware acceleration (`transform`, `opacity`)
- `will-change` for animated elements
- Minimal repaints/reflows
- CSS containment where applicable

### JavaScript
- Debounced scroll/resize handlers
- Lazy loading for images
- Virtual scrolling for long lists
- Event delegation
- RequestAnimationFrame for animations

### Assets
- SVG icons (scalable, small)
- WebP images with fallbacks
- Lazy loading
- Preload critical resources

---

## Icon System

### Libraries
- **Flaticon Uicons** 2.6.0 (Thin Rounded) - Primary icon set
- **Font Awesome** 6.4.0 (Regular/Solid) - Fallback icons

### Icon Implementation Strategy
The application uses a hybrid icon approach:
1. **Primary**: Flaticon thin-rounded icons for modern, lightweight aesthetics
2. **Fallback**: Font Awesome regular icons for compatibility
3. **Legacy**: Font Awesome solid icons for UI elements (chevrons, arrows)

### Current Icon Mapping

#### Message Actions
- **Copy**: `fi fi-tr-copy` (Flaticon)
- **Share**: `fi fi-tr-share-square` (Flaticon)
- **Success Feedback**: `fi fi-tr-check-circle` (Flaticon)

#### Navigation & Primary Actions
- **New Chat**: `fi fi-tr-comment-medical` (Flaticon)
- **Chat Sessions/History**: `fi fi-tr-rectangle-vertical-history` (Flaticon)
- **New Task**: `fi fi-tr-mail-plus-circle` (Flaticon)
- **Plus Button**: `fa-regular fa-plus` (Font Awesome Regular)

#### User & Account
- **Profile**: `fi fi-tr-circle-user` (Flaticon)
- **Logout**: `fi fi-tr-sign-out-alt` (Flaticon)

#### Context & Tools
- **Memory**: `fi fi-tr-brain` (Flaticon)
- **Attach File**: `fas fa-paperclip` (Font Awesome Solid)
- **Integrations**: `fi fi-tr-layer-plus` (Flaticon)

#### Settings & Info
- **Theme**: `fi fi-tr-circle-half-stroke` (Flaticon)
- **About**: `fi fi-tr-information` (Flaticon)
- **Support**: `fa-regular fa-circle-question` (Font Awesome Regular)

#### Code & Content
- **Code Copy**: `fi fi-tr-copy` (Flaticon)
- **Artifact Copy**: `fi fi-tr-copy` (Flaticon)
- **Download**: `fas fa-download` (Font Awesome Solid)
- **Close**: `fas fa-times` (Font Awesome Solid)

#### UI Elements (Font Awesome Solid)
- **Chevrons**: `fa-chevron-down`, `fa-chevron-right`
- **Arrows**: `fa-arrow-left`
- **Sync**: `fa-sync-alt`
- **Expand**: `fa-expand`

### Icon Sizing
- **Small**: 0.875rem (14px)
- **Normal**: 1rem (16px)
- **Large**: 1.25rem (20px)
- **XL**: 1.5rem (24px)

### Icon Loading
```html
<!-- Flaticon Uicons (Primary) -->
<link rel='stylesheet' href='https://cdn-uicons.flaticon.com/2.6.0/uicons-thin-rounded/css/uicons-thin-rounded.css'>

<!-- Font Awesome (Fallback) -->
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
```

### Icon Usage Guidelines
1. **Consistency**: Use Flaticon for user-facing actions, Font Awesome for UI chrome
2. **Weight**: Prefer thin/regular weights for modern aesthetic
3. **Accessibility**: Always include `aria-label` on icon-only buttons
4. **Fallback**: Test icon visibility; use Font Awesome if Flaticon icon doesn't exist
5. **Performance**: Icons are cached by service worker for offline use

---

## State Management

### Visual States
1. **Default**: Base appearance
2. **Hover**: Interactive feedback
3. **Active**: Pressed state
4. **Focus**: Keyboard navigation
5. **Disabled**: Non-interactive
6. **Loading**: Processing
7. **Error**: Validation failure
8. **Success**: Completion

### Application States
- **Connected**: Normal operation
- **Disconnected**: Offline mode
- **Reconnecting**: Attempting connection
- **Error**: Critical failure
- **Loading**: Initial load
- **Empty**: No content

---

## Best Practices

### Do's ✓
- Use semantic HTML
- Implement proper ARIA labels
- Test with keyboard only
- Support reduced motion
- Maintain color contrast
- Use consistent spacing
- Optimize animations
- Test on real devices
- Progressive enhancement
- Graceful degradation

### Don'ts ✗
- Don't rely on color alone
- Don't use tiny touch targets
- Don't block user input
- Don't auto-play media
- Don't use flashing content
- Don't ignore focus states
- Don't nest interactive elements
- Don't use fixed positioning excessively

---

## Future Considerations

### Potential Improvements
1. **Design Tokens**: Implement CSS custom properties system
2. **Component Library**: Create reusable component documentation
3. **Animation Library**: Standardized motion design system
4. **Micro-interactions**: Enhanced feedback for user actions ✓ (Partially implemented)
5. **Skeleton Screens**: Better loading states
6. **Gesture Support**: Swipe actions for mobile
7. **Haptic Feedback**: Touch vibration on mobile ✓ (Implemented in message actions)
8. **Voice Interface**: Accessibility enhancement
9. **Offline Mode**: Better offline experience ✓ (Service worker caching)
10. **Performance Monitoring**: Real-time metrics

### Recent Enhancements (v2.1)
- ✓ **Icon Consistency**: Unified icon system with Flaticon Uicons
- ✓ **Message Actions**: Copy and share functionality for bot messages
- ✓ **Mobile Optimization**: Touch-friendly action buttons with haptic feedback
- ✓ **Service Worker**: Enhanced caching for icon libraries and offline support
- ✓ **Accessibility**: Improved ARIA labels and keyboard navigation for actions

---

## Technical Stack

### Core Technologies
- **HTML5**: Semantic markup
- **CSS3**: Modern styling with custom properties
- **JavaScript ES6+**: Modular architecture
- **PWA**: Service worker, manifest

### Libraries
- **Marked.js**: Markdown parsing
- **DOMPurify**: XSS protection
- **Highlight.js**: Syntax highlighting
- **Mermaid**: Diagram rendering
- **Socket.IO**: Real-time communication
- **Flaticon Uicons**: Primary icon system (thin-rounded)
- **Font Awesome**: Fallback icon system

### Build Tools
- Native ES modules
- No build step required
- Service worker for caching

---

## Maintenance Guidelines

### Code Organization
```
css/
├── design-system.css      # Core variables & utilities
├── chat-variables.css     # Chat-specific tokens
├── style.css              # Global styles
├── mobile.css             # Mobile overrides
├── [component].css        # Component styles
```

### Naming Conventions
- **BEM-inspired**: `.component-element--modifier`
- **Utility classes**: `.flex`, `.hidden`, `.rounded-lg`
- **State classes**: `.active`, `.disabled`, `.expanded`

### Documentation
- Inline comments for complex logic
- JSDoc for functions
- CSS comments for sections
- README for setup instructions

---

## Version History
- **v1.0**: Initial release with blue theme
- **v2.0**: Neutral grayscale theme implementation
- **v2.1**: Icon system overhaul
  - Migrated to Flaticon Uicons (thin-rounded) for primary icons
  - Implemented hybrid icon strategy (Flaticon + Font Awesome)
  - Added message actions (Copy & Share buttons)
  - Enhanced mobile touch interactions
  - Updated service worker to cache icon libraries
- **Current**: Enhanced accessibility, performance, and icon consistency

---

*Last Updated: November 2024*
*Design System Version: 2.1*
