import prettier from "prettier";

export default {
  files: ["**/*.ts"],
  plugins: ["prettier"],
  rules: {
    "prettier/prettier": ["error"],
  },
};
