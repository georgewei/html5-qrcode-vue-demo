/**
 * @fileoverview
 * Complete Scanner build on top of {@link Html5Qrcode}.
 * - Decode QR Code using web cam or smartphone camera
 * 
 * @author mebjas <minhazav@gmail.com>
 * 
 * The word "QR Code" is registered trademark of DENSO WAVE INCORPORATED
 * http://www.denso-wave.com/qrcode/faqpatent-e.html
 * 
 * Note: ECMA Script is not supported by all browsers. Use minified/html5-qrcode.min.js for better
 * browser support. Alternatively the transpiled code lives in transpiled/html5-qrcode.js
 */
import { Html5Qrcode } from './html5-qrcode'

export class Html5QrcodeScanner {

  static SCAN_TYPE_CAMERA = "SCAN_TYPE_CAMERA";
  static SCAN_TYPE_FILE = "SCAN_TYPE_FILE";
  static STATUS_SUCCESS = "STATUS_SUCCESS";
  static STATUS_WARNING = "STATUS_WARNING";
  static STATUS_DEFAULT = "STATUS_DEFAULT";

  static ASSET_CAMERA_SCAN = require("../../assets/images/ic_camera_scan.gif");
  static ASSET_SWITCH_CAMERA = require('../../assets/images/ic_switch_camera.png');
  static ASSET_STOP_SCAN = require('../../assets/images/ic_stop.png');

  /**
   * Creates instance of this class.
   *
   * @param {String} elementId - Id of the HTML element.
   * @param {Object} config extra configurations to tune QR code scanner.
   *  Supported Fields:
   *      - fps: expected framerate of qr code scanning. example { fps: 2 }
   *          means the scanning would be done every 500 ms.
   *      - qrbox: width of QR scanning box, this should be smaller than
   *          the width and height of the box. This would make the scanner
   *          look like this:
   *          ----------------------
   *          |********************|
   *          |******,,,,,,,,,*****|      <--- shaded region
   *          |******|       |*****|      <--- non shaded region would be
   *          |******|       |*****|          used for QR code scanning.
   *          |******|_______|*****|
   *          |********************|
   *          |********************|
   *          ----------------------
   *      - aspectRatio: Optional, desired aspect ratio for the video feed.
   *          Ideal aspect ratios are 4:3 or 16:9. Passing very wrong aspect
   *          ratio could lead to video feed not showing up.
   *      - disableFlip: Optional, if {@code true} flipped QR Code won't be
   *          scanned. Only use this if you are sure the camera cannot give
   *          mirrored feed if you are facing performance constraints.
   * @param {Boolean} verbose - Optional argument, if true, all logs
   *                  would be printed to console. 
   */
  constructor(elementId, config, verbose) {
      this.elementId = elementId;
      this.config = config;
      this.verbose = verbose === true;

      if (!document.getElementById(elementId)) {
          throw `HTML Element with id=${elementId} not found`;
      }

      this.section = undefined;
      this.html5Qrcode = undefined;
      this.qrCodeStartScanCallback = undefined;
      this.qrCodeStopScanCallback = undefined;
      this.qrCodeSuccessCallback = undefined;
      this.qrCodeErrorCallback = undefined;
      this.cameras = undefined;
      this.cameraSelectedIndex = undefined; 
  }

  /**
   * Renders the User Interface
   * 
   * @param {Function} qrCodeSuccessCallback - callback on QR Code found.
   *  Example:
   *      function(qrCodeMessage) {}
   * @param {Function} qrCodeErrorCallback - callback on QR Code parse error.
   *  Example:
   *      function(errorMessage) {}
   * 
   */
  render(qrCodeStartScanCallback, qrCodeStopScanCallback, qrCodeSuccessCallback, qrCodeErrorCallback) {
      const $this = this;

      // Add wrapper to startScan callback.
      this.qrCodeStartScanCallback = () => {
        if (qrCodeStartScanCallback) {
            qrCodeStartScanCallback();
        }
      }

      // Add wrapper to stopScan callback.
      this.qrCodeStopScanCallback = () => {
        if (qrCodeStopScanCallback) {
            qrCodeStopScanCallback();
        }
      }

      // Add wrapper to success callback.
      this.qrCodeSuccessCallback = message => {
          $this.__stopScan();
          $this.__setStatus("MATCH", Html5QrcodeScanner.STATUS_SUCCESS);
          if (qrCodeSuccessCallback) {
              qrCodeSuccessCallback(message);
          }
      }

      // Add wrapper to failure callback
      this.qrCodeErrorCallback = error => {
          $this.__setStatus("Scanning");
          if (qrCodeErrorCallback) {
              qrCodeErrorCallback(error);
          }
      }

      const container = document.getElementById(this.elementId);
      container.innerHTML = "";
      this.__createBasicLayout(container);

      this.html5Qrcode = new Html5Qrcode(
          this.__getScanRegionId(), this.verbose);
  }

  /**
   * Removes the QR Code scanner.
   * 
   * @returns Promise which succeeds if the cleanup is complete successfully,
   *  fails otherwise.
   */
  clear() {
      const $this = this;
      const emptyHtmlContainer = () => {
          const mainContainer = document.getElementById(this.elementId);
          if (mainContainer) {
              mainContainer.innerHTML = "";
              this.__resetBasicLayout(mainContainer);
          }
      }

      if (this.html5Qrcode) {
          return new Promise((resolve, reject) => {
              if ($this.html5Qrcode._isScanning) {
                  $this.html5Qrcode.stop().then(() => {
                      $this.html5Qrcode.clear();
                      emptyHtmlContainer();
                      resolve();
                  }).catch(error => {
                      if ($this.verbose) {
                          console.error("Unable to stop qrcode scanner", error);
                      }
                      reject(error);
                  })
              }
          });
      }
  }

  //#region private control methods
  __createBasicLayout(parent) {
      this.__setStatus("IDLE");
      parent.style.position = "relative";
      parent.style.padding = "0px";
    //   parent.style.border = "1px solid silver";

      const qrCodeScanRegion = document.createElement("div");
      const scanRegionId = this.__getScanRegionId();
      qrCodeScanRegion.id = scanRegionId;
      qrCodeScanRegion.style.width = "100%";
      qrCodeScanRegion.style.minHeight = "100px";
      qrCodeScanRegion.style.textAlign = "center";
      parent.appendChild(qrCodeScanRegion);
      this.__insertCameraScanImageToScanRegion();

      const qrCodeDashboard = document.createElement("div");
      const dashboardId = this.__getDashboardId();
      qrCodeDashboard.id = dashboardId;
      qrCodeDashboard.style.width = "100%";
      parent.appendChild(qrCodeDashboard);

      this.__setupInitialDashboard(qrCodeDashboard);
}

__resetBasicLayout(parent) {
      parent.style.border = "none";
}

  __setupInitialDashboard(dashboard) {
      this.__createSection(dashboard);
      this.__createSectionControlPanel();
  }

  __createSection(dashboard) {
      const section = document.createElement("div");
      section.id = this.__getDashboardSectionId();
      section.style.width = "100%";
      section.style.textAlign = "left";
      dashboard.appendChild(section);
  }

  __createSectionControlPanel() {
      const $this = this;
      const section = document.getElementById(this.__getDashboardSectionId());
      const sectionControlPanel = document.createElement("div");
      section.appendChild(sectionControlPanel);
      const scpCameraScanRegion = document.createElement("div");
      scpCameraScanRegion.id = this.__getDashboardSectionCameraScanRegionId();
      scpCameraScanRegion.style.textAlign = "center";
      sectionControlPanel.appendChild(scpCameraScanRegion);

      const cameraActionStartButton = document.createElement("button");
      cameraActionStartButton.id = this.__getCameraActionStartButtonId();
      cameraActionStartButton.innerHTML = "Click to scan";
      cameraActionStartButton.style.height = "30px";
      cameraActionStartButton.style.padding ="5px";
      cameraActionStartButton.style.fontSize = "14px";
      cameraActionStartButton.addEventListener("click", function () {
        $this.qrCodeStartScanCallback();
        if ($this.cameraSelectedIndex !== undefined) {
              $this.__startScan();
          } else {
              $this.__getCameras();
          }
      });
      scpCameraScanRegion.appendChild(cameraActionStartButton);

      const enableFileScan = this.config ? this.config.enableFileScan : true;
      if (enableFileScan) {
        const span = document.createElement("span");
        span.innerHTML = "&nbsp;"
        scpCameraScanRegion.appendChild(span);

        const fileScanInput = document.createElement("input");
        fileScanInput.id = this.__getFileScanInputId();
        fileScanInput.accept = "image/*";
        fileScanInput.type = "file";
        fileScanInput.style.width = "0px";
        fileScanInput.style.opacity = 0;
        scpCameraScanRegion.appendChild(fileScanInput);

        fileScanInput.addEventListener('change', e => {
            if (e.target.files.length == 0) {
                return;
            }
            const file = e.target.files[0];
            $this.html5Qrcode.scanFile(file, true)
                .then(qrCode => {
                    $this.qrCodeSuccessCallback(qrCode);
                })
                .catch(error => {
                    $this.__setStatus("ERROR", Html5QrcodeScanner.STATUS_WARNING);
                    $this.qrCodeErrorCallback(error);
                });
        });

        const fileScanButton = document.createElement("button");
        fileScanButton.innerHTML = "从文件扫描";
        fileScanButton.style.height = "30px";
        fileScanButton.style.padding = "5px"
        fileScanButton.style.fontSize = "14px"
        scpCameraScanRegion.appendChild(fileScanButton);

        fileScanButton.addEventListener('click', () => {
            fileScanInput.click();
        });
      }
  }

  __getCameras() {
    this.__setStatus("PERMISSION");
    Html5Qrcode.getCameras().then(cameras => {
        this.__setStatus("IDLE");
        if (!cameras || cameras.length == 0) {
            this.__setStatus(
                "No Cameras", Html5QrcodeScanner.STATUS_WARNING);
        } else {
            this.cameras = cameras.map(entry => entry.id);
            this.cameraSelectedIndex = this.cameras.length - 1;
            this.__renderCameraScanPanel();
            this.__startScan();
        }
    }).catch(() => {
        this.__setStatus("IDLE");
    });
  }

  __renderCameraScanPanel() {
      const scpCameraScanRegion = document.getElementById(
          this.__getDashboardSectionCameraScanRegionId());
      scpCameraScanRegion.style.textAlign = "center";

      let cameraActionContainer = document.getElementById(this.__getCameraActionContainerId());
      if (!cameraActionContainer) {
        cameraActionContainer = document.createElement("span");
        cameraActionContainer.id = this.__getCameraActionContainerId();

        if (this.cameras && this.cameras.length > 1) {
            const cameraActionSwitchButton = document.createElement("img");
            cameraActionSwitchButton.id = this.__getCameraActionSwitchButtonId();
            cameraActionSwitchButton.width = 48;
            cameraActionSwitchButton.src = Html5QrcodeScanner.ASSET_SWITCH_CAMERA;
            cameraActionContainer.appendChild(cameraActionSwitchButton);

            cameraActionSwitchButton.addEventListener('click', () => {
                this.cameraSelectedIndex = (this.cameraSelectedIndex + 1) % this.cameras.length;
                this.__startScan();
            });

            const span = document.createElement("img");
            span.innerHTML = "&nbsp;"
            span.style.width = "10px"
            cameraActionContainer.appendChild(span);
        }

        const cameraActionStopButton = document.createElement("img");
        cameraActionStopButton.id = this.__getCameraActionStopButtonId();
        cameraActionStopButton.width = 48;
        cameraActionStopButton.src = Html5QrcodeScanner.ASSET_STOP_SCAN;
        cameraActionContainer.appendChild(cameraActionStopButton);

        scpCameraScanRegion.appendChild(cameraActionContainer);

        cameraActionStopButton.addEventListener('click', () => {
            this.__stopScan();
            this.qrCodeStopScanCallback();
        });
      }
  }

  __startScan() {
    this.__stopScan();

    const cameraActionStartButton = document.getElementById(this.__getCameraActionStartButtonId());
    cameraActionStartButton.style.display = "none";
    const config = this.config ?
        this.config : { fps: 10, qrbox: 250 };
    this.html5Qrcode.start(
        this.cameras[this.cameraSelectedIndex],
        config,
        this.qrCodeSuccessCallback,
        this.qrCodeErrorCallback)
        .then(() => {
            this.__getCameraActionContainer().style.display = "inline-block";
            this.__setStatus("Scanning");
        })
        .catch(() => {
            this.__setStatus("IDLE");
            cameraActionStartButton.style.display = "inline-block";
        });
  }

  __stopScan() {
    const cameraActionStartButton = document.getElementById(this.__getCameraActionStartButtonId());
    this.html5Qrcode.stop()
        .then(() => {
            this.__getCameraActionContainer().style.display = "none";
            if (cameraActionStartButton)
                cameraActionStartButton.style.display = "inline-block";
            this.__setStatus("IDLE");
            this.__insertCameraScanImageToScanRegion();
        }).catch(() => {
            this.__setStatus("ERROR", Html5QrcodeScanner.STATUS_WARNING);
        });
  }

  __setStatus(statusText, statusClass) {
      if (!statusClass) {
          statusClass = Html5QrcodeScanner.STATUS_DEFAULT;
      }
  }

  __insertCameraScanImageToScanRegion() {
      const $this = this;
      const qrCodeScanRegion = document.getElementById(
          this.__getScanRegionId());

      if (this.cameraScanImage) {
          qrCodeScanRegion.innerHTML = "<br>";
          qrCodeScanRegion.appendChild(this.cameraScanImage);
          return;
      }

      this.cameraScanImage = new Image;
      this.cameraScanImage.onload = () => {
          qrCodeScanRegion.innerHTML = "<br>";
          qrCodeScanRegion.appendChild($this.cameraScanImage);
      }
      this.cameraScanImage.width = 64;
      this.cameraScanImage.style.opacity = 0.3;
      this.cameraScanImage.src = Html5QrcodeScanner.ASSET_CAMERA_SCAN;
  }

  __clearScanRegion() {
      const qrCodeScanRegion = document.getElementById(
          this.__getScanRegionId());
      qrCodeScanRegion.innerHTML = "";
  }
  //#endregion

  //#region state getters
  __getDashboardSectionId() {
      return `${this.elementId}__dashboard_section`;
  }

  __getDashboardSectionCameraScanRegionId() {
      return `${this.elementId}__dashboard_section_csr`;
  }

  __getScanRegionId() {
      return `${this.elementId}__scan_region`;
  }

  __getDashboardId() {
      return `${this.elementId}__dashboard`;
  }

  __getFileScanInputId() {
      return `${this.elementId}__filescan_input`;
  }

  __getStatusSpanId() {
      return `${this.elementId}__status_span`;
  }

  __getCameraSelectionId() {
      return `${this.elementId}__camera_selection`;
  }

  __getCameraScanRegion() {
      return document.getElementById(
          this.__getDashboardSectionCameraScanRegionId());
  }

  __getCameraActionContainer() {
    return document.getElementById(
        this.__getCameraActionContainerId());
  }

  __getCameraActionContainerId() {
    return `${this.elementId}__camera_action_container`;
  }

  __getCameraActionSwitchButton() {
    return document.getElementById(
        this.__getCameraActionSwitchButtonId());
  }

  __getCameraActionSwitchButtonId() {
    return `${this.elementId}__switch_camera`;
  }

  __getCameraActionStartButtonId() {
    return `${this.elementId}__start_scan`;
  }

  __getCameraActionStopButtonId() {
    return `${this.elementId}__stop_scan`;
  }

  __getFileScanInput() {
      return document.getElementById(this.__getFileScanInputId());
  }
  //#endregion
}