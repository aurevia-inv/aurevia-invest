import InfoPage from '@/components/InfoPage';

export default function Support(){
  return <InfoPage eyebrow="Help center" title="Support information" lead="Support details for this deployment have not been configured, so this page does not invent a contact address or staffed service." sections={[
    {title:'Contact channel',content:<p>No support email, phone line, chat service, or response-time commitment is configured in this application. The deployment owner should publish a verified contact method before inviting customers to use a production service.</p>},
    {title:'Account access',content:<p>For this demo, use the sign-in and registration pages to manage your own test account. Protected areas require an authenticated account. Administrators can review supported account and demo funding requests in the admin workspace.</p>},
    {title:'Service status',content:<p>The application health endpoint reports whether the web application and configured database are reachable. It does not indicate external market-data, payment, custody, or exchange availability.</p>},
  ]}/>;
}