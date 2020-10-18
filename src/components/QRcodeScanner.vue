<template>
  <div>
    <div class="title">
      <p>Demo of using html5-qrcode scanner in VUE project</p>
    </div>
    <div class="scanQRCode_area">
      <div id="reader" ref="qrcode"></div>
    </div>
  </div>
</template>

<script>
import { Html5QrcodeScanner } from '@/scripts/html5-qrcode/html5-qrcode-scanner'

export default {
  data() {
    return {
      scanner: null
    }
  },
  mounted() {
    this.createQrcodeScanner();
  },
  methods: {
    createQrcodeScanner() {
      this.scanner = new Html5QrcodeScanner(
        "reader", { fps: 10, qrbox: 250, enableFileScan: false });
      this.scanner.render(this.onStartScan, this.onStopScan, this.onScanSuccess, this.onScanError);
    },
    onStartScan() {
      console.log("Action on start to scan here");
    },
    onStopScan() {
      console.log("Action on stop scanning here");
    },
    onScanSuccess(qrCodeMessage) {
      // handle on success condition with the decoded message
      console.log(qrCodeMessage);
      // this.scanner.clear();
      // ^ this will stop the scanner (video feed) and clear the scan area.
    },
    onScanError(errorMessage) {
      console.log(errorMessage);
      // handle on error condition, with error message
    }
  }
}
</script>

<style scoped>
.title {
  text-align: center;
  position: relative;
  padding: 5px;
}
.scanQRCode_area {
  width: 100%;
  align-items: center;
}
.scanQRCode {
  width: 200px;
  height: 240px;
}
</style>
