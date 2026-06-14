/** Jest config for gitignored local/ tree (CRA only scans src/ by default). */
const path = require("path");

module.exports = {
  rootDir: path.join(__dirname, ".."),
  roots: ["<rootDir>/local"],
  testMatch: ["<rootDir>/local/**/*.test.ts", "<rootDir>/local/**/*.test.tsx"],
  transform: {
    "^.+\\.(ts|tsx)$": [
      "babel-jest",
      { presets: [require.resolve("babel-preset-react-app")] },
    ],
  },
  transformIgnorePatterns: ["/node_modules/(?!.*)"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/local/app/setupTests.ts"],
};
