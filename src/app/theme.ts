import { createTheme } from '@mantine/core';

export const theme = createTheme({
  primaryColor: 'pine', primaryShade: 7, defaultRadius: 'md',
  fontFamily: "'Segoe UI', system-ui, sans-serif",
  headings: { fontFamily: "'Segoe UI', system-ui, sans-serif", fontWeight: '600' },
  colors: { pine: ['#edf7f2', '#d9ebe2', '#b1d5c6', '#88beaa', '#65a993', '#4d9b84', '#3e8e77', '#2a6858', '#214e43', '#143a33'] },
  components: {
    Button: { defaultProps: { fw: 500 } },
    NumberInput: { defaultProps: { radius: 'sm' } },
  },
});
