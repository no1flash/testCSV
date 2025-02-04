const { app, BrowserWindow, ipcMain, dialog, Menu } = require("electron");
const path = require("path");
const fs = require("fs"); // Load the File System to execute our common tasks (CRUD)
const dfd = require("danfojs-node");
const Papa = require("papaparse");

const data2 = [];
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1281,
    height: 800,
    minWidth: 1281,
    minHeight: 800,
    backgroundColor: "#312450",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadFile("index.html");
  mainWindow.webContents.openDevTools();
  const template = [
    {
      label: "File",
      submenu: [
        {
          label: "Open File",
          click() {
            // openFile();
            openFileWithDanfo();
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);

  Menu.setApplicationMenu(menu);
  // 웹 페이지 로드 완료
  mainWindow.webContents.on("did-finish-load", (evt) => {
    // onWebcontentsValue 이벤트 송신
    mainWindow.webContents.send("onWebcontentsValue", "on load...");
  });

  function openFile() {
    const files = dialog
      .showOpenDialog(mainWindow, {
        properties: ["openFile"],
      })
      .then((result) => {
        console.time("csv read");
        const file = result.filePaths[0];

        fs.createReadStream(file)
          .pipe(csv.parse({ headers: true }))
          .on("error", (error) => console.error(error))
          .on("data", (row) => data2.push(row))
          .on("end", () => {
            let end = performance.now();

            console.timeEnd("csv read");
          });
      })
      .catch((err) => {
        console.log(err);
      });
  }
  function openFileWithDanfo() {
    const files = dialog
      .showOpenDialog(mainWindow, {
        properties: ["openFile"],
      })
      .then((result) => {
        console.time("csv read");
        const file = result.filePaths[0];

        dfd
          .readCSV(file) //assumes file is in CWD
          .then((df) => {
            data = df;
            console.timeEnd("csv read");
          })
          .catch((err) => {
            console.log(err);
          });
      })
      .catch((err) => {
        console.log(err);
      });
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
  app.on("window-all-closed", function () {
    if (process.platform !== "darwin") app.quit();
  });

  ipcMain.on("show-open-dialog", (event, arg) => {
    dialog
      .showOpenDialog(null, {
        properties: ["openFile"],
      })
      .then((result) => {
        const file = result.filePaths[0];
        const csvFile = fs.readFileSync(file);
        const csvData = csvFile.toString();
        console.time("csv read");
        Papa.parse(csvData, {
          header: true,
          skipEmptyLines: false,
          complete: (results) => {
            const result = convert(results.data);
            event.sender.send("open-dialog-paths-selected", result);
          },
        });
      })
      .catch((err) => {
        console.log(err);
      });
  });

  ipcMain.on("handle-duplicate", (event, rowData) => {
    const rowDataNoDup = [...removeDup(rowData).values()];
    event.sender.send("on-handle-duplicate", rowDataNoDup);
  });
  ipcMain.on("handle-save", (event, name) =>
    event.sender.send("on-handle-save", name)
  );
  ipcMain.on("handle-search", (event, flag) =>
    event.sender.send("on-handle-search", flag)
  );
  ipcMain.on("handle-change-val", (evt, payload) => {
    const [rowData, columns, oldVal, newVal] = payload;
    const resuklt = rowData.map((data) => {
      const old = Object.values(data).find((val) => val === oldVal);
      const key = Object.keys(data).find((item) => data[item] === oldVal);
      return {
        ...data,
        [key]: old ? newVal : oldVal,
      };
    });
    evt.sender.send("on-handle-change-val", [...resuklt]);
  });
  ipcMain.on("handle-calc", (evt, args) => {
    const [col1, col2, col3, sign, rowData] = args;
    const result = rowData.map((data) => ({
      ...data,
      [col3]: calculate(
        sign,
        data[col1.toLowerCase()],
        data[col2.toLowerCase()]
      ),
    }));
    evt.sender.send("on-handle-calc", [result, col3]);
  });
  ipcMain.on("handle-merge", (evt, args) => {
    const [rowData, selectedRows] = args;
    const newColNames = selectedRows[0] + selectedRows[1];
    const newRowData = rowData.map((row) => {
      return {
        ...row,
        [newColNames]:
          row[selectedRows[0].toLowerCase()] +
          row[selectedRows[1].toLowerCase()],
      };
    });
    evt.sender.send("on-handle-merge", [newRowData, newColNames]);
  });
});

function removeDup(rowData) {
  const newRowData = new Map();
  for (let row of rowData) {
    newRowData.set(JSON.stringify(row), row);
  }
  return newRowData;
}

const convert = (results) => {
  const rowsArray = Object.keys(results[0]);
  return {
    columns: rowsArray,
    data: results,
  };
};

const calculate = (sign, val1, val2) => {
  const [v1, v2] = [Number(val1), Number(val2)];
  if (sign === "+") {
    return v1 + v2;
  } else if (sign === "-") {
    return v1 - v2;
  } else if (sign === "*") {
    return v1 * v2;
  } else if (sign === "/") {
    return v1 / v2;
  }
};
