module.exports = {
  setupFilesAfterEnv: ['./tests/init.js'],
  moduleNameMapper: {
    '\\.(css|scss|jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga|tgs)$':
      '<rootDir>/tests/staticFileMock.js',
  },
  testPathIgnorePatterns: [
    '<rootDir>/tests/playwright/',
    '<rootDir>/node_modules/',
    '<rootDir>/legacy_notes_and_workbook/',
    '<rootDir>/client/src/stylesheets/',
  ],
  testEnvironment: 'jsdom',
  transform: {
    '\\.(jsx?|tsx?)$': 'babel-jest',
    '\\.txt$': 'jest-raw-loader',
  },
  globals: {
    APP_REVISION: "jest-test",
  },
};
