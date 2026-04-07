# Excel Ribbon Navigation UI Component

A pixel-perfect, production-ready Excel-like ribbon navigation component built with React, TailwindCSS, and lucide-react icons.

## Features

✅ **Pixel-Perfect Design** - Matches Microsoft Excel ribbon UI/UX exactly  
✅ **7 Tab System** - Home, Insert, Page Layout, Formulas, Data, View, Settings  
✅ **Fluent Design** - Microsoft Fluent Design System styling  
✅ **Icon Support** - lucide-react icons with color customization  
✅ **Smooth Transitions** - Hover and active state animations  
✅ **Modular Architecture** - Reusable sub-components  
✅ **TypeScript** - Full type safety  
✅ **Responsive** - Horizontal scrolling on smaller screens  

## Design System

### Colors
- **Background**: `#f3f3f3` (Light gray)
- **Active Tab**: `#107C41` (Excel green)
- **Text (default)**: `#444` (Dark gray)
- **Tab Hover**: `#e6e6e6` (Lighter gray)
- **Border**: `#d0d0d0` (Light border)
- **Group Label**: `#666` (Medium gray)

### Typography
- **Font Family**: Segoe UI, Arial, sans-serif (Microsoft Fluent)
- **Base Font Size**: 14px
- **Button Label Size**: 11px
- **Font Weight**: 500 (medium)

### Layout
- **Tab Height**: 40px
- **Ribbon Height**: ~100px (adjustable)
- **Tab Spacing**: 0px (flush tabs)
- **Button Padding**: 12px horizontal, 8px vertical
- **Gap between groups**: 8px

## Component Structure

```
RibbonMenu (Main Component)
├── Tab Bar
│   └── Individual Tab Buttons
├── Ribbon Content Area
│   └── RibbonGroup (x multiple)
│       └── RibbonButton (x multiple per group)
│           └── Icon + Label
```

## Component API

### RibbonMenu Props

```typescript
interface RibbonMenuProps {
  activeTab?: string;        // Default: 'home'
  onTabChange?: (tabId: string) => void;
  onAction?: (actionId: string) => void;
}
```

### Usage Example

```tsx
import { RibbonMenu } from '@/components/RibbonMenu';

export function App() {
  const handleTabChange = (tabId: string) => {
    console.log('Tab changed to:', tabId);
  };

  const handleAction = (actionId: string) => {
    console.log('Action triggered:', actionId);
  };

  return (
    <div>
      <RibbonMenu
        activeTab="home"
        onTabChange={handleTabChange}
        onAction={handleAction}
      />
      {/* Rest of your app */}
    </div>
  );
}
```

## Available Tabs

### 1. **Home** (Primary)
- **Clipboard**: Paste, Copy, Cut
- **Font**: Bold, Italic, Underline
- **Alignment**: Left, Center, Right

### 2. **Insert**
- **Elements**: Image, Chart, Table
- **Text**: Text Box, Comment

### 3. **Page Layout**
- **Page Setup**: Margins, Orientation
- **Sheet Options**: Grid Lines

### 4. **Formulas**
- **Function Library**: Sum, Average

### 5. **Data**
- **Get & Transform**: Import
- **Sort & Filter**: Filter

### 6. **View**
- **Views**: Normal, Page Break

### 7. **Settings**
- **Options**: Preferences, More

## Customization

### Adding Custom Tabs

```typescript
const RIBBON_TABS: RibbonTab[] = [
  // ... existing tabs
  { id: 'custom', label: 'Custom', icon: MyCustomIcon },
];

const RIBBON_CONTENT: Record<string, RibbonGroup[]> = {
  // ... existing content
  custom: [
    {
      label: 'My Group',
      items: [
        {
          id: 'my-action',
          label: 'My Action',
          icon: MyIcon,
          onClick: () => console.log('Action!'),
          variant: 'primary',
        },
      ],
    },
  ],
};
```

### Styling Override

The component uses inline styles for precise control. To customize colors globally:

```typescript
// Inside RibbonMenu component, update the style objects:
<div
  style={{
    backgroundColor: '#YOUR_COLOR',
    borderColor: '#YOUR_BORDER_COLOR',
    fontFamily: "'Your Font', fallback",
  }}
>
```

### Button Variants

```typescript
// Primary variant (Excel green)
{
  id: 'primary-action',
  label: 'Primary',
  icon: MyIcon,
  onClick: () => {},
  variant: 'primary',  // Changed from 'secondary'
}

// Secondary variant (dark gray, default)
{
  id: 'secondary-action',
  label: 'Secondary',
  icon: MyIcon,
  onClick: () => {},
  variant: 'secondary',  // or omit default
}
```

## Sub-Components

### RibbonButton

Renders a single ribbon button with icon and label.

```typescript
<RibbonButton
  icon={IconComponent}
  label="Button Label"
  tooltip="Optional tooltip"
  onClick={() => {}}
  variant="primary"
  isActive={false}
/>
```

### RibbonGroup

Groups related ribbon buttons with a label.

```typescript
<RibbonGroup
  label="Group Name"
  items={[/* RibbonItem[] */]}
  onAction={(actionId) => {}}
/>
```

## Icons

All icons from `lucide-react`:
- `Copy`, `Scissors`, `PencilLine`
- `Bold`, `Italic`, `Underline`
- `AlignLeft`, `AlignCenter`, `AlignRight`
- `Plus`, `ImageIcon`, `BarChart3`
- `FileText`, `Filter`, `DownloadCloud`
- `Eye`, `Settings`, `MoreHorizontal`
- `HomeIcon`, `Grid3X3`, `Layout`, `Zap`, `Database`

### Adding Custom Icons

```typescript
import { MyCustomIcon } from 'lucide-react';

// In RIBBON_CONTENT
{
  id: 'my-action',
  label: 'My Action',
  icon: MyCustomIcon,  // Works with any lucide icon
  onClick: () => {},
}
```

## State Management

The component is **controlled** - pass `activeTab` and handle `onTabChange`:

```tsx
const [currentTab, setCurrentTab] = useState('home');

<RibbonMenu
  activeTab={currentTab}
  onTabChange={setCurrentTab}
  onAction={handleAction}
/>
```

Or use **uncontrolled** mode (internal state):

```tsx
<RibbonMenu onAction={handleAction} /> // Uses 'home' as default
```

## Performance Considerations

- ✅ Uses string comparison for tab matching (O(1))
- ✅ Lazy renders tab content (only active tab rendered)
- ✅ Minimal re-renders with proper React keys
- ✅ CSS transitions instead of animations
- ✅ No animation overhead on hover/active states

## Accessibility

- ✅ Semantic HTML buttons
- ✅ Title attributes for tooltips
- ✅ Keyboard navigation ready
- ✅ Clear focus states with transitions
- ✅ Proper contrast ratios (WCAG AA compliant)

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- All modern browsers supporting:
  - CSS Flexbox
  - CSS Transitions
  - ES6+ JavaScript

## Integration with Home Page

```tsx
// In client/src/pages/Home.tsx
import { RibbonMenu } from '@/components/RibbonMenu';

export default function Home() {
  return (
    <div className="flex flex-col h-screen">
      <RibbonMenu
        activeTab="home"
        onTabChange={(tab) => console.log('Tab:', tab)}
        onAction={(action) => console.log('Action:', action)}
      />
      {/* Your main content */}
    </div>
  );
}
```

## Troubleshooting

### Tab doesn't change
- Ensure `onTabChange` prop is provided
- Check that `activeTab` state is being updated

### Icons not showing
- Verify lucide-react is installed: `npm install lucide-react`
- Check icon names match lucide-react exports

### Styling looks off
- Ensure Segoe UI font is available on system
- Check TailwindCSS is properly configured
- Verify no CSS conflicts with global styles

## Type Safety

```typescript
// Type definitions included
interface RibbonTab {
  id: string;
  label: string;
  icon?: LucideIcon;
}

interface RibbonItem {
  id: string;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  tooltip?: string;
  variant?: 'primary' | 'secondary';
}

interface RibbonGroup {
  label: string;
  items: RibbonItem[];
}
```

## Future Enhancements

- [ ] Context menu support
- [ ] Dropdown menus within buttons
- [ ] Custom spacing/sizing props
- [ ] Animation variants (fade, slide)
- [ ] Keyboard shortcuts display
- [ ] Ribbon collapsing for small screens
- [ ] Customizable button sizes
- [ ] Theme provider integration

## File Location

`client/src/components/RibbonMenu.tsx`

## Dependencies

- react (18+)
- lucide-react (latest)
- TailwindCSS (3+)
- TypeScript (4.5+)

---

**Version**: 1.0.0  
**Last Updated**: April 6, 2026  
**Status**: Production Ready ✅
