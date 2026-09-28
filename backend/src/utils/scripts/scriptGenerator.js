import path from "path";

const Mapping = {
    'python': 'py',
    'javascript' : 'js',
    'java' : 'java',
    'c++': 'cpp',
    'c' : 'c'
}

const Run = {
    'python': 'python',
    'javascript' : 'node',
    'java' : 'java',
    'c++': 'gcc', 
    'c' : 'gcc'
}

const container = {
    'python': 'python:3.9-alpine',
    'javascript' : 'node:alpine', 
    'java' : 'openjdk:alpine',    
    'c++': 'gcc',
    'c' : 'gcc'
}

export const scriptGenerator = (language, absolutePath) => {
    const filename = `runner.${Mapping[language]}`;
    const runCommand = Run[language];
    const cont = container[language];

    return [
        'run',
        '--network', 'none',
        '--rm',
        '--memory', '256m',
        '--cpus', '0.5',
        '-v', `${absolutePath}:/docker_temp`,
        '-w', '/docker_temp',
        cont,
        runCommand,
        filename
    ];
};