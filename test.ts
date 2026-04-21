import axios from 'axios';

async function test() {
  try {
    const res = await axios.get('http://127.0.0.1:3000/api/health');
    console.log(res.status, res.data);
  } catch (e) {
    console.log(e.response?.status, e.response?.data, e.message);
  }
}
test();
