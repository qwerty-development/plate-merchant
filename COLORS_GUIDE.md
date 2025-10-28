# Brand Colors Guide

## Your Color Palette

All colors are now configured in Tailwind and ready to use throughout the app!

| Color Name | Hex Code | Usage |
|------------|----------|-------|
| `background` | `#ffece2` | Main background color |
| `primary` | `#792339` | Primary brand color, buttons, headers |
| `accent` | `#F2b25f` | Accent color, highlights |
| `gray` | `#787878` | Secondary text, borders |
| `lavender` | `#d9c3db` | Tertiary color, subtle accents |

## How to Use with Tailwind Classes

### Background Colors
```jsx
<View className="bg-background">     {/* #ffece2 */}
<View className="bg-primary">        {/* #792339 */}
<View className="bg-accent">         {/* #F2b25f */}
<View className="bg-gray">           {/* #787878 */}
<View className="bg-lavender">       {/* #d9c3db */}
```

### Text Colors
```jsx
<Text className="text-background">  {/* #ffece2 */}
<Text className="text-primary">     {/* #792339 */}
<Text className="text-accent">      {/* #F2b25f */}
<Text className="text-gray">        {/* #787878 */}
<Text className="text-lavender">    {/* #d9c3db */}
```

### Border Colors
```jsx
<View className="border border-primary">      {/* #792339 */}
<View className="border border-lavender">     {/* #d9c3db */}
<View className="border-2 border-accent">     {/* #F2b25f with 2px width */}
```

## Example: Button with Brand Colors

```jsx
// Primary button
<TouchableOpacity className="bg-primary rounded-xl p-4">
  <Text className="text-background font-semibold">
    Click Me
  </Text>
</TouchableOpacity>

// Accent button
<TouchableOpacity className="bg-accent rounded-xl p-4">
  <Text className="text-primary font-semibold">
    Secondary Action
  </Text>
</TouchableOpacity>

// Outlined button
<TouchableOpacity className="bg-transparent border-2 border-primary rounded-xl p-4">
  <Text className="text-primary font-semibold">
    Outlined
  </Text>
</TouchableOpacity>
```

## Example: Input Fields

```jsx
<TextInput
  className="bg-white border border-lavender rounded-xl p-4 text-primary"
  placeholderTextColor="#d9c3db"
  placeholder="Enter text..."
/>
```

## Common Patterns

### Card with shadow
```jsx
<View className="bg-white rounded-2xl p-4 border border-lavender">
  <Text className="text-primary font-bold">Card Title</Text>
  <Text className="text-gray">Card description</Text>
</View>
```

### Section header
```jsx
<View className="bg-background border-b border-lavender pb-2">
  <Text className="text-primary text-2xl font-bold">Section Title</Text>
</View>
```

## Need More?

If you need to add more colors, edit `tailwind.config.js`:

```js
theme: {
  extend: {
    colors: {
      background: '#ffece2',
      primary: '#792339',
      accent: '#F2b25f',
      gray: '#787878',
      lavender: '#d9c3db',
      // Add new colors here
      newColor: '#hexcode',
    },
  },
},
```

After making changes, restart the dev server for changes to take effect!



