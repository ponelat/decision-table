
export default function downloadStrAsFile(str, filename='data.json', mediaType='text/json'){
  const dataStr = `data:${mediaType};charset=utf-8,` + encodeURIComponent(str)
  const downloadAnchorNode = document.createElement('a')
  downloadAnchorNode.setAttribute("href",     dataStr)
  downloadAnchorNode.setAttribute("download", filename)
  document.body.appendChild(downloadAnchorNode); // required for firefox
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
}
