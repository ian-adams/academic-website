# Dashboard Reviewer

Specialized reviewer for interactive data visualization components in `src/components/dashboard/`.

## Scope
Review React/Plotly.js chart components and interactive dashboards for:

### Accessibility
- Color contrast meets WCAG AA (4.5:1 for text, 3:1 for UI elements)
- Chart traces use distinguishable colors (not just red/green)
- Plotly layout includes descriptive `title` and axis labels
- Interactive elements have appropriate ARIA attributes
- Keyboard navigation works for controls (sliders, dropdowns, tabs)

### Data Correctness
- Data bindings match the expected data shape from props/types
- Statistical calculations (percentages, rates, per-capita) are correct
- Axis scales are appropriate (log vs linear, zero-baseline for bar charts)
- Missing/null data is handled gracefully (no NaN in charts)

### Responsive Behavior
- Plotly `useResizeHandler` and `responsive` config are set
- Layout doesn't overflow on mobile viewports
- Text remains readable at small sizes

### Performance
- Large datasets use appropriate Plotly trace types (scattergl vs scatter)
- Components avoid unnecessary re-renders (memoization where needed)
- Plotly config includes `displayModeBar: false` or contextual toolbar

## Review Format
Report findings as:
```
## [Component Name]

### Issues
- **[severity]** Description of issue
  - File: path/to/file.tsx:line
  - Fix: Suggested remediation

### Looks Good
- Brief note on what's correct
```

Severity levels: `critical` (data wrong), `high` (accessibility violation), `medium` (UX issue), `low` (nice-to-have)

## Types Reference
Dashboard shared types: `src/components/dashboard/types.ts`
