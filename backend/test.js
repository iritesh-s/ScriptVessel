import { exec } from 'node:child_process'
import fs from "fs";

const code = "print('Hello from the dynamic file!')";
let pa = `${process.cwd()}\\temp`;
console.log(pa);
try {
  const promise = fs.promises.writeFile("./temp/temp.py",
    code,);
  await promise;
} catch (err) {
  console.error(err);
}
const cmd = `docker run --network none --rm --memory 1024m --cpus="0.5" -v ${pa}:/docker_temp -w /docker_temp python:3.9-alpine python temp.py `
exec(cmd, (error, stdout, stderr) => {
    if (error) {
        console.error(`exec error: ${error}`);
        return;
    }
    console.log(`stdout: ${stdout}`);
    console.error(`stderr: ${stderr}`);
});
