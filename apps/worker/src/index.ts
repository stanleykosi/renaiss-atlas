import { scaffoldJobNames } from "./job-runner.js";

console.log(
  JSON.stringify(
    {
      service: "renaiss-atlas-worker",
      mode: "scaffold",
      jobs: scaffoldJobNames
    },
    null,
    2
  )
);
