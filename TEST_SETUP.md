# Testing Setup Guide

## Installation

Install Jest and required dependencies:

```bash
npm install --save-dev @types/jest jest ts-jest @testing-library/react-native
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test rotationEngine.test

# Run tests matching pattern
npm test -- --testNamePattern="ACGME"
```

## Test Structure

```
__tests__/
  └── rotationEngine.test.ts    # Rotation algorithm tests
```

## What's Tested

### ✅ ACGME Compliance (8 tests)
- Hour limits (80/week)
- Days off requirements (1/week minimum)
- Night shift limits (4/week max)
- Multiple violations handling

### ✅ Scoring Algorithm (5 tests)
- Hour-based prioritization
- Night shift distribution
- Consecutive day breaks
- Days off prioritization
- Weekend fairness

### ✅ Eligibility Filtering (6 tests)
- Role exclusions
- Vacation blocks
- Hour limit enforcement
- Consecutive night limits

### ✅ Pairing Logic (2 tests)
- Required pair identification
- No pairing scenarios

### ✅ Hour Calculations (3 tests)
- Total hour calculations
- Days off calculations
- Weekend identification

### ✅ Edge Cases (3 tests)
- New resident (no history)
- Multiple constraints
- Equal scores

### ✅ Integration Scenarios (3 tests)
- Typical week compliance
- Workload balancing
- Vacation respect

## Coverage Goals

- **Branches**: 70%
- **Functions**: 70%
- **Lines**: 70%
- **Statements**: 70%

## Test Categories

### Unit Tests
Focus on individual functions and logic:
- ACGME compliance checks
- Scoring calculations
- Eligibility filters

### Integration Tests
Test multiple components together:
- Week generation
- Constraint enforcement
- Compliance tracking

## Writing New Tests

### Pattern 1: Arrange-Act-Assert
```typescript
test('should do something', () => {
  // Arrange
  const input = createMockData();

  // Act
  const result = functionToTest(input);

  // Assert
  expect(result).toBe(expected);
});
```

### Pattern 2: Data-Driven Tests
```typescript
const testCases = [
  { input: 40, expected: true },
  { input: 85, expected: false },
];

testCases.forEach(({ input, expected }) => {
  test(`should handle ${input}`, () => {
    expect(isCompliant(input)).toBe(expected);
  });
});
```

## Mocking

### Mock Functions
```typescript
const mockFunction = jest.fn();
mockFunction.mockReturnValue('result');
```

### Mock Modules
```typescript
jest.mock('../services/api', () => ({
  getScheduleWeeks: jest.fn(),
}));
```

## Debugging Tests

```bash
# Run with Node debugger
node --inspect-brk node_modules/.bin/jest --runInBand

# Use console.log
console.log('Debug:', value);

# Use VS Code debugger
# Set breakpoint and press F5
```

## CI/CD Integration

Add to your CI pipeline:

```yaml
# GitHub Actions example
- name: Run tests
  run: npm test -- --ci --coverage --maxWorkers=2

- name: Upload coverage
  uses: codecov/codecov-action@v3
```

## Best Practices

1. **Test behavior, not implementation**
   - Focus on outputs, not internal logic

2. **Keep tests simple**
   - One assertion per test when possible
   - Clear test names

3. **Use descriptive names**
   - `test('should exclude resident on vacation')` ✅
   - `test('test1')` ❌

4. **Arrange-Act-Assert pattern**
   - Separate setup, execution, verification

5. **Test edge cases**
   - Empty arrays
   - Null/undefined
   - Boundary values

6. **Don't test external libraries**
   - Test YOUR code, not React Native or Supabase

## Future Test Ideas

- [ ] SQL function tests (database layer)
- [ ] API endpoint tests (integration)
- [ ] UI component tests (React Native Testing Library)
- [ ] E2E tests (Detox)
- [ ] Performance tests (rotation generation speed)
